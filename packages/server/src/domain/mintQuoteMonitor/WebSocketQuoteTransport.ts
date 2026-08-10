import { WsTransport } from "@/domain/communicator/infra/WsTransport";
import type {
  RealTimeTransport,
  WsNotification,
  WsRequest,
} from "@/domain/communicator/infra/types";
import WebSocket from "ws";
import type { Logger } from "winston";
import type { MintRequestBudget } from "@/infrastructure/MintRequestBudget";
import {
  isMintQuotePayload,
  type MintQuotePayload,
} from "./MintQuoteClient";
import type { ActiveQuoteTransport } from "./MintQuoteMonitor";

interface Subscription {
  subId: string;
  quoteId: string;
  onPayload: (payload: MintQuotePayload) => void | Promise<void>;
}

interface MintSubscriptions {
  hasOpened: boolean;
  nextRequestId: number;
  bySubId: Map<string, Subscription>;
  needsResubscribe: Set<string>;
}

interface WebSocketQuoteTransportOptions {
  transport?: RealTimeTransport;
  logger?: Logger;
  createSubscriptionId?: () => string;
  periodicReconnectMs?: number;
  requestBudget?: MintRequestBudget;
}

export class WebSocketQuoteTransport implements ActiveQuoteTransport {
  private readonly transport: RealTimeTransport;
  private readonly logger?: Logger;
  private readonly createSubscriptionId: () => string;
  private readonly byMint = new Map<string, MintSubscriptions>();

  constructor(options: WebSocketQuoteTransportOptions = {}) {
    this.logger = options.logger;
    this.createSubscriptionId =
      options.createSubscriptionId ??
      (() => Math.random().toString(36).slice(2, 15));
    this.transport =
      options.transport ??
      new WsTransport(
        (url) => new WebSocket(url) as any,
        options.logger,
        {
          disableReconnect: false,
          periodicReconnectMs: options.periodicReconnectMs ?? 180_000,
          requestBudget: options.requestBudget,
        },
      );
  }

  watch(
    mintUrl: string,
    quoteId: string,
    onPayload: (payload: MintQuotePayload) => void | Promise<void>,
  ): () => void {
    const mint = this.ensureMint(mintUrl);
    if (mint.hasOpened) {
      // Sending can replace a socket that is already closing without emitting
      // its stale close event, so replay subscriptions that predate this send.
      for (const existingSubId of mint.bySubId.keys()) {
        mint.needsResubscribe.add(existingSubId);
      }
    }
    const subId = this.createSubscriptionId();
    mint.bySubId.set(subId, { subId, quoteId, onPayload });
    this.sendSubscribe(mintUrl, mint, subId);

    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      const current = this.byMint.get(mintUrl);
      if (!current || !current.bySubId.delete(subId)) return;
      current.needsResubscribe.delete(subId);

      if (current.bySubId.size === 0) {
        this.byMint.delete(mintUrl);
        this.transport.closeMint(mintUrl);
        return;
      }
      const request: WsRequest = {
        jsonrpc: "2.0",
        method: "unsubscribe",
        params: { subId },
        id: ++current.nextRequestId,
      };
      this.transport.send(mintUrl, request);
    };
  }

  stop(): void {
    this.byMint.clear();
    this.transport.closeAll();
  }

  private ensureMint(mintUrl: string): MintSubscriptions {
    const existing = this.byMint.get(mintUrl);
    if (existing) return existing;

    const mint: MintSubscriptions = {
      hasOpened: false,
      nextRequestId: 0,
      bySubId: new Map(),
      needsResubscribe: new Set(),
    };
    this.byMint.set(mintUrl, mint);
    this.transport.on(mintUrl, "message", (event) => {
      this.handleMessage(mintUrl, event);
    });
    this.transport.on(mintUrl, "open", () => {
      const current = this.byMint.get(mintUrl);
      if (!current) return;
      if (!current.hasOpened && current.needsResubscribe.size === 0) {
        current.hasOpened = true;
        return;
      }
      current.hasOpened = true;
      const pending = [...current.needsResubscribe];
      current.needsResubscribe.clear();
      for (const subId of pending) {
        this.sendSubscribe(mintUrl, current, subId);
      }
      if (pending.length > 0) {
        this.logger?.info(
          "[QuoteMonitor] Re-subscribed quotes after WebSocket reopen",
          { mintUrl, count: pending.length },
        );
      }
    });
    this.transport.on(mintUrl, "close", () => {
      const current = this.byMint.get(mintUrl);
      if (!current) return;
      current.needsResubscribe = new Set(current.bySubId.keys());
    });
    return mint;
  }

  private sendSubscribe(
    mintUrl: string,
    mint: MintSubscriptions,
    subId: string,
  ): void {
    const subscription = mint.bySubId.get(subId);
    if (!subscription) return;
    const request: WsRequest = {
      jsonrpc: "2.0",
      method: "subscribe",
      params: {
        kind: "bolt11_mint_quote",
        subId,
        filters: [subscription.quoteId],
      },
      id: ++mint.nextRequestId,
    };
    this.transport.send(mintUrl, request);
  }

  private handleMessage(mintUrl: string, event: any): void {
    try {
      const raw =
        typeof event.data === "string"
          ? event.data
          : event.data?.toString?.();
      if (!raw) return;
      const notification = JSON.parse(raw) as WsNotification<MintQuotePayload>;
      if (notification.method !== "subscribe") return;
      const subscription = this.byMint
        .get(mintUrl)
        ?.bySubId.get(notification.params?.subId);
      if (!subscription) return;
      const payload = notification.params?.payload;
      if (!isMintQuotePayload(payload)) {
        this.logger?.warn("[QuoteMonitor] Ignored invalid WebSocket quote payload", {
          mintUrl,
          quoteId: subscription.quoteId,
        });
        return;
      }
      Promise.resolve(subscription.onPayload(payload)).catch(
        (cause) => {
          this.logger?.error("[QuoteMonitor] WebSocket quote callback failed", {
            mintUrl,
            quoteId: subscription.quoteId,
            cause,
          });
        },
      );
    } catch (cause) {
      this.logger?.warn("[QuoteMonitor] Ignored invalid WebSocket message", {
        mintUrl,
        cause,
      });
    }
  }
}
