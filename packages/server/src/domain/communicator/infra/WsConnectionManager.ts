import {
  PerMintRequestBudget,
  type MintRequestBudget,
} from "@/infrastructure/MintRequestBudget";
import { randomBytes } from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { Logger } from "winston";
import type {
  WebSocketLike,
  WebSocketFactory,
  WsConnectionManagerOptions,
} from "./types";

const DEFAULT_PERIODIC_RECONNECT_MS = 180000; // 3 minutes
const HANDSHAKE_PROBE_COOLDOWN_MS = 60_000;
const HANDSHAKE_PROBE_TIMEOUT_MS = 5_000;
const MAX_LOGGED_HANDSHAKE_BODY_LENGTH = 2_000;

export class WsConnectionManager {
  private readonly sockets = new Map<string, WebSocketLike>();
  private readonly isOpenByMint = new Map<string, boolean>();
  private readonly sendQueueByMint = new Map<string, string[]>();
  private readonly logger?: Logger;
  private readonly listenersByMint = new Map<
    string,
    Map<"open" | "message" | "error" | "close", Set<(event: any) => void>>
  >();
  private readonly reconnectAttemptsByMint = new Map<string, number>();
  private readonly reconnectTimeoutByMint = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly periodicReconnectTimers = new Map<
    string,
    ReturnType<typeof setInterval>
  >();
  private readonly pendingConnectionsByMint = new Map<
    string,
    AbortController
  >();
  private readonly lastHandshakeProbeAtByMint = new Map<string, number>();
  private readonly options: Required<
    Omit<WsConnectionManagerOptions, "requestBudget">
  >;
  private readonly requestBudget: MintRequestBudget;
  private readonly wsFactory: WebSocketFactory;

  constructor(
    wsFactory: WebSocketFactory,
    logger?: Logger,
    options?: WsConnectionManagerOptions,
  ) {
    this.wsFactory = wsFactory;
    this.logger = logger;
    this.options = {
      disableReconnect: options?.disableReconnect ?? false,
      periodicReconnectMs:
        options?.periodicReconnectMs ?? DEFAULT_PERIODIC_RECONNECT_MS,
    };
    this.requestBudget = options?.requestBudget ?? new PerMintRequestBudget();
  }

  private buildWsUrl(baseMintUrl: string): string {
    const url = new URL(baseMintUrl);
    const isSecure = url.protocol === "https:";
    url.protocol = isSecure ? "wss:" : "ws:";
    const path = url.pathname.endsWith("/")
      ? url.pathname.slice(0, -1)
      : url.pathname;
    url.pathname = `${path}/v1/ws`;
    return url.toString();
  }

  private probeRejectedHandshake(mintUrl: string, wsUrl: string): void {
    if (!this.logger) return;
    const now = Date.now();
    const lastProbeAt = this.lastHandshakeProbeAtByMint.get(mintUrl);
    if (
      lastProbeAt !== undefined &&
      now - lastProbeAt < HANDSHAKE_PROBE_COOLDOWN_MS
    ) {
      return;
    }
    this.lastHandshakeProbeAtByMint.set(mintUrl, now);

    const url = new URL(wsUrl);
    const request = url.protocol === "wss:" ? httpsRequest : httpRequest;
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";

    try {
      const probe = request(url, {
        headers: {
          Connection: "Upgrade",
          Upgrade: "websocket",
          "Sec-WebSocket-Key": randomBytes(16).toString("base64"),
          "Sec-WebSocket-Version": "13",
        },
      });
      probe.setTimeout(HANDSHAKE_PROBE_TIMEOUT_MS, () => {
        probe.destroy(new Error("WebSocket handshake diagnostic timed out"));
      });
      probe.on("response", (response) => {
        let body = "";
        let bodyLength = 0;
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          bodyLength += chunk.length;
          if (body.length < MAX_LOGGED_HANDSHAKE_BODY_LENGTH) {
            body += chunk.slice(
              0,
              MAX_LOGGED_HANDSHAKE_BODY_LENGTH - body.length,
            );
          }
        });
        response.on("end", () => {
          this.logger?.error("[WS] WebSocket handshake rejected", {
            transport: "ws",
            mintUrl,
            statusCode: response.statusCode,
            statusMessage: response.statusMessage,
            retryAfter: response.headers["retry-after"],
            contentType: response.headers["content-type"],
            body,
            bodyTruncated: bodyLength > body.length,
          });
        });
      });
      probe.on("upgrade", (response, socket) => {
        socket.destroy();
        this.logger?.info(
          "[WS] WebSocket handshake diagnostic succeeded after connection error",
          {
            transport: "ws",
            mintUrl,
            statusCode: response.statusCode,
          },
        );
      });
      probe.on("error", (cause) => {
        this.logger?.warn("[WS] WebSocket handshake diagnostic failed", {
          transport: "ws",
          mintUrl,
          err: cause.message,
        });
      });
      probe.end();
    } catch (cause) {
      this.logger.warn("[WS] WebSocket handshake diagnostic failed", {
        transport: "ws",
        mintUrl,
        err: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  private ensureSocket(mintUrl: string): void {
    const existing = this.sockets.get(mintUrl);
    if (existing && existing.readyState <= 1) {
      return;
    }
    if (existing) {
      this.sockets.delete(mintUrl);
      this.isOpenByMint.set(mintUrl, false);
      this.clearPeriodicReconnectTimer(mintUrl);
    }
    if (this.pendingConnectionsByMint.has(mintUrl)) return;

    const controller = new AbortController();
    this.pendingConnectionsByMint.set(mintUrl, controller);
    void this.requestBudget
      .schedule(
        mintUrl,
        () => {
          if (
            controller.signal.aborted ||
            this.pendingConnectionsByMint.get(mintUrl) !== controller
          ) {
            return;
          }
          this.pendingConnectionsByMint.delete(mintUrl);
          this.createSocket(mintUrl);
        },
        controller.signal,
      )
      .catch((err) => {
        if (this.pendingConnectionsByMint.get(mintUrl) === controller) {
          this.pendingConnectionsByMint.delete(mintUrl);
        }
        if (controller.signal.aborted) return;
        this.logger?.error("[WS] Connection attempt failed", {
          transport: "ws",
          mintUrl,
          err,
        });
        if (!this.options.disableReconnect && this.hasListeners(mintUrl)) {
          this.scheduleReconnect(mintUrl);
        }
      });
  }

  private createSocket(mintUrl: string): void {
    const wsUrl = this.buildWsUrl(mintUrl);
    this.logger?.info("[WS] Creating connection", { transport: "ws", mintUrl, wsUrl });
    const socket = this.wsFactory(wsUrl);
    this.sockets.set(mintUrl, socket);
    this.isOpenByMint.set(mintUrl, false);

    const onOpen = (event: any) => {
      if (this.sockets.get(mintUrl) !== socket) return;
      this.isOpenByMint.set(mintUrl, true);
      const pending = this.reconnectTimeoutByMint.get(mintUrl);
      if (pending) {
        clearTimeout(pending);
        this.reconnectTimeoutByMint.delete(mintUrl);
      }
      this.reconnectAttemptsByMint.delete(mintUrl);
      this.lastHandshakeProbeAtByMint.delete(mintUrl);

      const queue = this.sendQueueByMint.get(mintUrl);
      if (queue && queue.length > 0) {
        this.logger?.debug("[WS] Flushing queued messages", {
          transport: "ws",
          mintUrl,
          count: queue.length,
        });
        for (const payload of queue) {
          try {
            socket.send(payload);
          } catch (err) {
            this.logger?.error("[WS] Send error while flushing queue", {
              transport: "ws",
              mintUrl,
              err,
            });
          }
        }
        this.sendQueueByMint.set(mintUrl, []);
      }

      this.logger?.info("[WS] Connection opened", { transport: "ws", mintUrl });
      this.schedulePeriodicReconnect(mintUrl);
      this.emitToListeners(mintUrl, "open", event);
    };

    const onError = (err: any) => {
      if (this.sockets.get(mintUrl) !== socket) return;
      const message = err?.message || err;
      this.logger?.error("[WS] Connection error", {
        transport: "ws",
        mintUrl,
        err: message,
      });
      if (
        typeof message === "string" &&
        message.includes("Expected 101 status code")
      ) {
        this.probeRejectedHandshake(mintUrl, wsUrl);
      }
      this.emitToListeners(mintUrl, "error", err);
    };

    const onClose = (event: any) => {
      if (this.sockets.get(mintUrl) !== socket) return;
      this.logger?.info("[WS] Connection closed", { transport: "ws", mintUrl });
      this.sockets.delete(mintUrl);
      this.isOpenByMint.set(mintUrl, false);
      this.sendQueueByMint.delete(mintUrl);
      this.clearPeriodicReconnectTimer(mintUrl);

      if (!this.options.disableReconnect && this.hasListeners(mintUrl)) {
        this.scheduleReconnect(mintUrl);
      }
      this.emitToListeners(mintUrl, "close", event);
    };

    const onMessage = (event: any) => {
      if (this.sockets.get(mintUrl) !== socket) return;
      this.emitToListeners(mintUrl, "message", event);
    };

    socket.addEventListener("open", onOpen);
    socket.addEventListener("message", onMessage);
    socket.addEventListener("error", onError);
    socket.addEventListener("close", onClose);
  }

  private hasListeners(mintUrl: string): boolean {
    const listeners = this.listenersByMint.get(mintUrl);
    return (
      listeners !== undefined &&
      Array.from(listeners.values()).some((set) => set.size > 0)
    );
  }

  private clearPeriodicReconnectTimer(mintUrl: string): void {
    const timer = this.periodicReconnectTimers.get(mintUrl);
    if (!timer) return;
    clearInterval(timer);
    this.periodicReconnectTimers.delete(mintUrl);
  }

  private emitToListeners(
    mintUrl: string,
    type: "open" | "message" | "error" | "close",
    event: any,
  ): void {
    const listeners = this.listenersByMint.get(mintUrl)?.get(type);
    if (!listeners) return;
    for (const listener of [...listeners]) listener(event);
  }

  private schedulePeriodicReconnect(mintUrl: string): void {
    const existingTimer = this.periodicReconnectTimers.get(mintUrl);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    const timer = setInterval(() => {
      this.forceReconnect(mintUrl);
    }, this.options.periodicReconnectMs);

    this.periodicReconnectTimers.set(mintUrl, timer);
    this.logger?.debug("[WS] Scheduled periodic reconnect", {
      transport: "ws",
      mintUrl,
      intervalMs: this.options.periodicReconnectMs,
    });
  }

  private forceReconnect(mintUrl: string): void {
    this.logger?.info("[WS] Forcing periodic reconnect", { transport: "ws", mintUrl });
    const existing = this.sockets.get(mintUrl);
    if (existing) {
      try {
        existing.close(1000, "Periodic reconnect");
        return;
      } catch (err) {
        this.logger?.warn("[WS] Error closing socket for periodic reconnect", {
          transport: "ws",
          mintUrl,
          err,
        });
        this.sockets.delete(mintUrl);
        this.isOpenByMint.set(mintUrl, false);
      }
    }
    if (this.hasListeners(mintUrl)) {
      this.ensureSocket(mintUrl);
    }
  }

  private scheduleReconnect(mintUrl: string): void {
    if (this.reconnectTimeoutByMint.get(mintUrl)) return;
    const attempt = (this.reconnectAttemptsByMint.get(mintUrl) ?? 0) + 1;
    this.reconnectAttemptsByMint.set(mintUrl, attempt);
    const delayMs = Math.min(30000, 1000 * 2 ** Math.min(6, attempt - 1));
    this.logger?.info("[WS] Scheduling reconnect", { transport: "ws", mintUrl, attempt, delayMs });

    const timeoutId = setTimeout(() => {
      this.reconnectTimeoutByMint.delete(mintUrl);
      this.ensureSocket(mintUrl);
    }, delayMs);
    this.reconnectTimeoutByMint.set(mintUrl, timeoutId);
  }

  on(
    mintUrl: string,
    type: "open" | "message" | "error" | "close",
    listener: (event: any) => void,
  ): void {
    let map = this.listenersByMint.get(mintUrl);
    if (!map) {
      map = new Map();
      this.listenersByMint.set(mintUrl, map);
    }
    let set = map.get(type);
    if (!set) {
      set = new Set();
      map.set(type, set);
    }
    if (set.has(listener)) return;
    set.add(listener);

    this.ensureSocket(mintUrl);
  }

  off(
    mintUrl: string,
    type: "open" | "message" | "error" | "close",
    listener: (event: any) => void,
  ): void {
    const map = this.listenersByMint.get(mintUrl);
    const set = map?.get(type);
    set?.delete(listener);
  }

  send(mintUrl: string, message: unknown): void {
    this.ensureSocket(mintUrl);
    const socket = this.sockets.get(mintUrl);
    const payload = typeof message === "string" ? message : JSON.stringify(message);
    const isOpen = this.isOpenByMint.get(mintUrl);

    if (socket && isOpen) {
      try {
        socket.send(payload);
        this.logger?.debug("[WS] Sent message", {
          transport: "ws",
          mintUrl,
          payloadLength: payload.length,
        });
      } catch (err) {
        this.logger?.error("[WS] Send error", { transport: "ws", mintUrl, err });
      }
      return;
    }

    let queue = this.sendQueueByMint.get(mintUrl);
    if (!queue) {
      queue = [];
      this.sendQueueByMint.set(mintUrl, queue);
    }
    queue.push(payload);
    this.logger?.debug("[WS] Queued message (socket not open)", {
      transport: "ws",
      mintUrl,
      queueLength: queue.length,
    });
  }

  isConnected(mintUrl: string): boolean {
    return (
      this.isOpenByMint.get(mintUrl) === true &&
      this.sockets.get(mintUrl)?.readyState === 1
    );
  }

  closeAll(): void {
    for (const timer of this.periodicReconnectTimers.values()) {
      clearInterval(timer);
    }
    this.periodicReconnectTimers.clear();

    for (const timeout of this.reconnectTimeoutByMint.values()) {
      clearTimeout(timeout);
    }
    this.reconnectTimeoutByMint.clear();
    this.reconnectAttemptsByMint.clear();
    this.lastHandshakeProbeAtByMint.clear();

    for (const controller of this.pendingConnectionsByMint.values()) {
      controller.abort(new Error("WebSocket manager closed"));
    }
    this.pendingConnectionsByMint.clear();

    const sockets = [...this.sockets.entries()];
    this.sockets.clear();
    this.listenersByMint.clear();
    for (const [mintUrl, socket] of sockets) {
      try {
        socket.close(1000, "Normal Closure");
      } catch (err) {
        this.logger?.warn("[WS] Error while closing", { transport: "ws", mintUrl, err });
      }
    }
    this.isOpenByMint.clear();
    this.sendQueueByMint.clear();
  }

  closeMint(mintUrl: string): void {
    this.clearPeriodicReconnectTimer(mintUrl);

    const timeout = this.reconnectTimeoutByMint.get(mintUrl);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeoutByMint.delete(mintUrl);
    }
    this.reconnectAttemptsByMint.delete(mintUrl);
    this.lastHandshakeProbeAtByMint.delete(mintUrl);

    const pendingConnection = this.pendingConnectionsByMint.get(mintUrl);
    if (pendingConnection) {
      this.pendingConnectionsByMint.delete(mintUrl);
      pendingConnection.abort(new Error("Mint closed"));
    }

    const socket = this.sockets.get(mintUrl);
    this.sockets.delete(mintUrl);
    this.listenersByMint.delete(mintUrl);
    if (socket) {
      try {
        socket.close(1000, "Mint closed");
        this.logger?.debug("[WS] Closed for mint", { transport: "ws", mintUrl });
      } catch (err) {
        this.logger?.warn("[WS] Error while closing for mint", { transport: "ws", mintUrl, err });
      }
    }

    this.isOpenByMint.delete(mintUrl);
    this.sendQueueByMint.delete(mintUrl);
    this.logger?.info("[WS] Closed mint", { transport: "ws", mintUrl });
  }
}
