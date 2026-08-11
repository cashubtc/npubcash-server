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

const MAX_FILTERS_PER_SUBSCRIPTION = 50;

interface QuoteSubscription {
  quoteId: string;
  onPayload: (payload: MintQuotePayload) => void | Promise<void>;
  subId?: string;
}

interface WireSubscription {
  subId: string;
  quoteIds: Set<string>;
  queued: boolean;
}

interface MintSubscriptions {
  hasOpened: boolean;
  isOpen: boolean;
  nextRequestId: number;
  byQuoteId: Map<string, QuoteSubscription>;
  bySubId: Map<string, WireSubscription>;
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
    const subscription: QuoteSubscription = { quoteId, onPayload };
    mint.byQuoteId.set(quoteId, subscription);

    if (mint.isOpen) {
      const wasConnected = this.transport.isConnected(mintUrl);
      const subId = this.sendSubscribe(mintUrl, mint, [quoteId]);
      if (!wasConnected && subId) {
        // WsTransport can replace a socket that has entered CLOSING before its
        // close event is delivered. The new quote is queued for that socket;
        // subscriptions from the old socket must be replayed on its open.
        this.retainQueuedSubscription(mint, subId);
      }
    }

    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      const current = this.byMint.get(mintUrl);
      if (!current || current.byQuoteId.get(quoteId) !== subscription) return;
      current.byQuoteId.delete(quoteId);

      let emptiedSubscription: WireSubscription | undefined;
      if (subscription.subId) {
        const wireSubscription = current.bySubId.get(subscription.subId);
        // NUT-17 cannot remove one filter from a subscription. Stop routing
        // this quote locally and retain the wire subscription for its others.
        wireSubscription?.quoteIds.delete(quoteId);
        if (wireSubscription?.quoteIds.size === 0) {
          current.bySubId.delete(subscription.subId);
          emptiedSubscription = wireSubscription;
        }
      }

      if (current.byQuoteId.size === 0) {
        this.byMint.delete(mintUrl);
        this.transport.closeMint(mintUrl);
        return;
      }
      if (
        emptiedSubscription &&
        (emptiedSubscription.queued ||
          (current.isOpen && this.transport.isConnected(mintUrl)))
      ) {
        const request: WsRequest = {
          jsonrpc: "2.0",
          method: "unsubscribe",
          params: { subId: emptiedSubscription.subId },
          id: ++current.nextRequestId,
        };
        this.transport.send(mintUrl, request);
      }
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
      isOpen: false,
      nextRequestId: 0,
      byQuoteId: new Map(),
      bySubId: new Map(),
    };
    this.byMint.set(mintUrl, mint);
    this.transport.on(mintUrl, "message", (event) => {
      this.handleMessage(mintUrl, event);
    });
    this.transport.on(mintUrl, "open", () => {
      const current = this.byMint.get(mintUrl);
      if (!current) return;
      const reopening = current.hasOpened;
      current.hasOpened = true;
      current.isOpen = true;
      for (const wireSubscription of current.bySubId.values()) {
        wireSubscription.queued = false;
      }
      const pending = [...current.byQuoteId.values()]
        .filter((subscription) => subscription.subId === undefined)
        .map((subscription) => subscription.quoteId);
      this.sendSubscribeBatches(mintUrl, current, pending);
      if (reopening && pending.length > 0) {
        this.logger?.info(
          "[QuoteMonitor] Re-subscribed quotes after WebSocket reopen",
          { mintUrl, count: pending.length },
        );
      }
    });
    this.transport.on(mintUrl, "close", () => {
      const current = this.byMint.get(mintUrl);
      if (!current) return;
      current.isOpen = false;
      this.clearWireSubscriptions(current);
    });
    return mint;
  }

  private sendSubscribeBatches(
    mintUrl: string,
    mint: MintSubscriptions,
    quoteIds: readonly string[],
  ): void {
    for (
      let offset = 0;
      offset < quoteIds.length;
      offset += MAX_FILTERS_PER_SUBSCRIPTION
    ) {
      this.sendSubscribe(
        mintUrl,
        mint,
        quoteIds.slice(offset, offset + MAX_FILTERS_PER_SUBSCRIPTION),
      );
    }
  }

  private sendSubscribe(
    mintUrl: string,
    mint: MintSubscriptions,
    quoteIds: readonly string[],
  ): string | undefined {
    const activeQuoteIds = [...new Set(quoteIds)].filter((quoteId) =>
      mint.byQuoteId.has(quoteId),
    );
    if (activeQuoteIds.length === 0) return undefined;

    const subId = this.createSubscriptionId();
    mint.bySubId.set(subId, {
      subId,
      quoteIds: new Set(activeQuoteIds),
      queued: false,
    });
    for (const quoteId of activeQuoteIds) {
      mint.byQuoteId.get(quoteId)!.subId = subId;
    }
    const request: WsRequest = {
      jsonrpc: "2.0",
      method: "subscribe",
      params: {
        kind: "bolt11_mint_quote",
        subId,
        filters: activeQuoteIds,
      },
      id: ++mint.nextRequestId,
    };
    this.transport.send(mintUrl, request);
    return subId;
  }

  private retainQueuedSubscription(
    mint: MintSubscriptions,
    queuedSubId: string,
  ): void {
    for (const [subId, wireSubscription] of mint.bySubId) {
      if (subId === queuedSubId) continue;
      for (const quoteId of wireSubscription.quoteIds) {
        const subscription = mint.byQuoteId.get(quoteId);
        if (subscription?.subId === subId) subscription.subId = undefined;
      }
      mint.bySubId.delete(subId);
    }
    const queuedSubscription = mint.bySubId.get(queuedSubId);
    if (queuedSubscription) queuedSubscription.queued = true;
    mint.isOpen = false;
  }

  private clearWireSubscriptions(mint: MintSubscriptions): void {
    for (const subscription of mint.byQuoteId.values()) {
      subscription.subId = undefined;
    }
    mint.bySubId.clear();
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
      const mint = this.byMint.get(mintUrl);
      const wireSubscription = mint?.bySubId.get(notification.params?.subId);
      if (!mint || !wireSubscription) return;
      const payload = notification.params?.payload;
      if (!isMintQuotePayload(payload)) {
        this.logger?.warn("[QuoteMonitor] Ignored invalid WebSocket quote payload", {
          mintUrl,
        });
        return;
      }
      if (!wireSubscription.quoteIds.has(payload.quote)) return;
      const subscription = mint.byQuoteId.get(payload.quote);
      if (!subscription || subscription.subId !== wireSubscription.subId) {
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
