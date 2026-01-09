import type { Logger } from "winston";
import WebSocket from "ws";
import type {
  RealTimeTransport,
  WsRequest,
  WsResponse,
  WsNotification,
  SubscriptionCallback,
  UnsubscribeHandler,
  MintQuotePayload,
  HybridSubscriptionManagerOptions,
  WebSocketFactory,
} from "./types";
import { HybridTransport } from "./HybridTransport";
import { MintAdapter } from "./MintAdapter";

function generateSubId(): string {
  return Math.random().toString(36).substring(2, 15);
}

interface ActiveSubscription {
  subId: string;
  mintUrl: string;
  quoteId: string;
  callbacks: Set<SubscriptionCallback<MintQuotePayload>>;
}

export class HybridSubscriptionManager {
  private readonly nextIdByMint = new Map<string, number>();
  private readonly subscriptions = new Map<string, ActiveSubscription>();
  private readonly activeByMint = new Map<string, Set<string>>();
  private readonly pendingSubscribeByMint = new Map<string, Map<number, string>>();
  private readonly transportByMint = new Map<string, RealTimeTransport>();
  private readonly messageHandlerByMint = new Map<string, (evt: any) => void>();
  private readonly openHandlerByMint = new Map<string, (evt: any) => void>();
  private readonly hasOpenedByMint = new Map<string, boolean>();
  private readonly logger?: Logger;
  private readonly mintAdapter: MintAdapter;
  private readonly options: Required<Omit<HybridSubscriptionManagerOptions, "logger">>;

  constructor(options?: HybridSubscriptionManagerOptions) {
    this.logger = options?.logger;
    this.mintAdapter = new MintAdapter(this.logger);
    this.options = {
      slowPollingIntervalMs: options?.slowPollingIntervalMs ?? 20000,
      fastPollingIntervalMs: options?.fastPollingIntervalMs ?? 5000,
      periodicReconnectMs: options?.periodicReconnectMs ?? 180000,
    };
  }

  private getTransport(mintUrl: string): RealTimeTransport {
    let t = this.transportByMint.get(mintUrl);
    if (t) return t;

    const wsFactory: WebSocketFactory = (url: string) => {
      return new WebSocket(url) as any;
    };

    t = new HybridTransport(
      wsFactory,
      this.mintAdapter,
      {
        slowPollingIntervalMs: this.options.slowPollingIntervalMs,
        fastPollingIntervalMs: this.options.fastPollingIntervalMs,
        periodicReconnectMs: this.options.periodicReconnectMs,
      },
      this.logger,
    );
    this.transportByMint.set(mintUrl, t);
    return t;
  }

  private getNextId(mintUrl: string): number {
    const current = this.nextIdByMint.get(mintUrl) ?? 0;
    const next = current + 1;
    this.nextIdByMint.set(mintUrl, next);
    return next;
  }

  private ensureMessageListener(mintUrl: string): void {
    if (this.messageHandlerByMint.has(mintUrl)) return;

    const handler = (evt: any) => {
      try {
        const data =
          typeof evt.data === "string" ? evt.data : evt.data?.toString?.();
        if (!data) return;
        const parsed = JSON.parse(data) as
          | WsNotification<MintQuotePayload>
          | WsResponse;

        if ("method" in parsed && parsed.method === "subscribe") {
          const subId = parsed.params?.subId;
          const active = subId ? this.subscriptions.get(subId) : undefined;
          if (active) {
            const payload = (parsed as WsNotification<MintQuotePayload>).params
              .payload;
            for (const cb of active.callbacks) {
              Promise.resolve(cb(payload)).catch((err) =>
                this.logger?.error("[SubMgr] Subscription callback error", {
                  transport: "submgr",
                  mintUrl,
                  subId,
                  err,
                }),
              );
            }
          }
        } else if ("error" in parsed && (parsed as WsResponse).error) {
          const resp = parsed as WsResponse;
          const respId = Number((resp as any).id);
          const err = resp.error!;
          const pendingMap = this.pendingSubscribeByMint.get(mintUrl);
          const maybeSubId =
            Number.isFinite(respId) && pendingMap
              ? pendingMap.get(respId)
              : undefined;
          if (maybeSubId) {
            this.subscriptions.delete(maybeSubId);
            pendingMap?.delete(respId);
            this.logger?.error("[SubMgr] Subscribe request rejected", {
              transport: "submgr",
              mintUrl,
              id: resp.id,
              subId: maybeSubId,
              code: err.code,
              message: err.message,
            });
          } else {
            this.logger?.error("[SubMgr] Request error", {
              transport: "submgr",
              mintUrl,
              id: resp.id,
              code: err.code,
              message: err.message,
            });
          }
        } else if ("result" in parsed && (parsed as WsResponse).result) {
          const resp = parsed as WsResponse;
          const respId = Number((resp as any).id);
          const pendingMap = this.pendingSubscribeByMint.get(mintUrl);
          if (Number.isFinite(respId) && pendingMap && pendingMap.has(respId)) {
            const subId = pendingMap.get(respId);
            pendingMap.delete(respId);
            this.logger?.debug("[SubMgr] Subscribe request accepted", {
              transport: "submgr",
              mintUrl,
              id: resp.id,
              subId: subId || resp.result?.subId,
            });
          }
        }
      } catch (err) {
        this.logger?.error("[SubMgr] Message handling error", { transport: "submgr", mintUrl, err });
      }
    };

    const t = this.getTransport(mintUrl);
    t.on(mintUrl, "message", handler);
    this.messageHandlerByMint.set(mintUrl, handler);

    const onOpen = () => {
      try {
        const hasOpened = this.hasOpenedByMint.get(mintUrl) === true;
        if (hasOpened) {
          this.logger?.info(
            "[SubMgr] Transport open detected, re-subscribing active subscriptions",
            { transport: "submgr", mintUrl },
          );
          this.reSubscribeMint(mintUrl);
        } else {
          this.hasOpenedByMint.set(mintUrl, true);
          this.logger?.debug("[SubMgr] Transport open detected, initial open", {
            transport: "submgr",
            mintUrl,
          });
        }
      } catch (err) {
        this.logger?.error("[SubMgr] Failed to handle open event", { transport: "submgr", mintUrl, err });
      }
    };

    t.on(mintUrl, "open", onOpen);
    this.openHandlerByMint.set(mintUrl, onOpen);
  }

  subscribe(
    mintUrl: string,
    quoteId: string,
    onNotification?: SubscriptionCallback<MintQuotePayload>,
  ): { subId: string; unsubscribe: UnsubscribeHandler } {
    this.ensureMessageListener(mintUrl);

    // Check for existing subscription with same quoteId
    for (const [existingSubId, existingSub] of this.subscriptions.entries()) {
      if (existingSub.mintUrl === mintUrl && existingSub.quoteId === quoteId) {
        if (onNotification) {
          existingSub.callbacks.add(onNotification);
          this.logger?.debug("[SubMgr] Reusing existing subscription", {
            transport: "submgr",
            mintUrl,
            quoteId,
            subId: existingSubId,
          });
        }
        return {
          subId: existingSubId,
          unsubscribe: () => {
            if (onNotification) {
              this.removeCallback(existingSubId, onNotification);
            }
            if (existingSub.callbacks.size === 0) {
              this.unsubscribe(mintUrl, existingSubId);
            }
          },
        };
      }
    }

    const id = this.getNextId(mintUrl);
    const subId = generateSubId();

    const req: WsRequest = {
      jsonrpc: "2.0",
      method: "subscribe",
      params: { kind: "bolt11_mint_quote", subId, filters: [quoteId] },
      id,
    };

    const active: ActiveSubscription = {
      subId,
      mintUrl,
      quoteId,
      callbacks: new Set(),
    };
    if (onNotification) active.callbacks.add(onNotification);
    this.subscriptions.set(subId, active);

    let set = this.activeByMint.get(mintUrl);
    if (!set) {
      set = new Set();
      this.activeByMint.set(mintUrl, set);
    }
    set.add(subId);

    let pendingById = this.pendingSubscribeByMint.get(mintUrl);
    if (!pendingById) {
      pendingById = new Map();
      this.pendingSubscribeByMint.set(mintUrl, pendingById);
    }
    pendingById.set(id, subId);

    const t = this.getTransport(mintUrl);
    this.logger?.debug("[SubMgr] Sending subscribe request", {
      transport: "submgr",
      mintUrl,
      quoteId,
      subId,
      id,
    });
    t.send(mintUrl, req);
    this.logger?.info("[SubMgr] Subscribed to mint quote", { transport: "submgr", mintUrl, quoteId, subId });

    return {
      subId,
      unsubscribe: () => {
        this.unsubscribe(mintUrl, subId);
      },
    };
  }

  addCallback(
    subId: string,
    cb: SubscriptionCallback<MintQuotePayload>,
  ): void {
    const active = this.subscriptions.get(subId);
    if (!active) throw new Error("Subscription not found");
    active.callbacks.add(cb);
  }

  removeCallback(
    subId: string,
    cb: SubscriptionCallback<MintQuotePayload>,
  ): void {
    const active = this.subscriptions.get(subId);
    if (!active) return;
    active.callbacks.delete(cb);
  }

  unsubscribe(mintUrl: string, subId: string): void {
    this.logger?.debug("[SubMgr] Unsubscribing", {
      transport: "submgr",
      mintUrl,
      subId,
      hasSubscription: this.subscriptions.has(subId),
    });

    const id = this.getNextId(mintUrl);
    const req: WsRequest = {
      jsonrpc: "2.0",
      method: "unsubscribe",
      params: { subId },
      id,
    };

    const t = this.getTransport(mintUrl);
    t.send(mintUrl, req);
    this.subscriptions.delete(subId);
    const set = this.activeByMint.get(mintUrl);
    set?.delete(subId);

    this.logger?.info("[SubMgr] Unsubscribed from mint quote", {
      transport: "submgr",
      mintUrl,
      subId,
      remainingSubscriptions: this.subscriptions.size,
    });
  }

  closeAll(): void {
    const seen = new Set<RealTimeTransport>();
    for (const t of this.transportByMint.values()) {
      if (seen.has(t)) continue;
      seen.add(t);
      t.closeAll();
    }
    this.subscriptions.clear();
    this.activeByMint.clear();
    this.pendingSubscribeByMint.clear();
    this.hasOpenedByMint.clear();
    this.transportByMint.clear();
    this.messageHandlerByMint.clear();
    this.openHandlerByMint.clear();
    this.nextIdByMint.clear();
  }

  closeMint(mintUrl: string): void {
    this.logger?.info("[SubMgr] Closing all subscriptions for mint", { transport: "submgr", mintUrl });

    const subIds = this.activeByMint.get(mintUrl);
    if (subIds) {
      for (const subId of subIds) {
        this.subscriptions.delete(subId);
      }
    }

    this.activeByMint.delete(mintUrl);
    this.pendingSubscribeByMint.delete(mintUrl);
    this.nextIdByMint.delete(mintUrl);
    this.messageHandlerByMint.delete(mintUrl);
    this.openHandlerByMint.delete(mintUrl);
    this.hasOpenedByMint.delete(mintUrl);

    const transport = this.transportByMint.get(mintUrl);
    if (transport) {
      transport.closeMint(mintUrl);
      this.transportByMint.delete(mintUrl);
    }

    this.logger?.info("[SubMgr] Closed mint subscriptions", { transport: "submgr", mintUrl });
  }

  private reSubscribeMint(mintUrl: string): void {
    const set = this.activeByMint.get(mintUrl);
    if (!set || set.size === 0) return;

    for (const subId of set) {
      const active = this.subscriptions.get(subId);
      if (!active) continue;

      const id = this.getNextId(mintUrl);
      const req: WsRequest = {
        jsonrpc: "2.0",
        method: "subscribe",
        params: {
          kind: "bolt11_mint_quote",
          subId: active.subId,
          filters: [active.quoteId],
        },
        id,
      };

      let pendingById = this.pendingSubscribeByMint.get(mintUrl);
      if (!pendingById) {
        pendingById = new Map();
        this.pendingSubscribeByMint.set(mintUrl, pendingById);
      }
      pendingById.set(id, subId);

      const t = this.getTransport(mintUrl);
      t.send(mintUrl, req);
      this.logger?.info("[SubMgr] Re-subscribed after reconnect", {
        transport: "submgr",
        mintUrl,
        quoteId: active.quoteId,
        subId: active.subId,
      });
    }
  }
}
