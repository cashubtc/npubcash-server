import type { MintQuote } from "@/domain/mintQuote/MintQuote";
import {
  WebSocketQuoteTransport,
  type WebSocketQuoteTransportOptions,
} from "@/domain/mintQuoteMonitor/WebSocketQuoteTransport";
import type { EventEmitter, Events } from "@/events";
import { normalizeUrl } from "@/utils/utils";
import type { MintQuoteMonitoringStore } from "./MintQuoteMonitoringStore";
import type { QuoteObservationHandler } from "./QuoteObservationHandler";
import type { QuoteWebSocketTransport } from "./QuoteWebSocketTransport";

export interface QuoteWebSocketService {
  start(): Promise<void>;
  stop(): Promise<void>;
}

interface QuoteWebSocketLogger {
  info(message: string, meta?: Record<string, unknown>): unknown;
  warn(message: string, meta?: Record<string, unknown>): unknown;
}

interface DefaultQuoteWebSocketServiceOptions {
  store: Pick<MintQuoteMonitoringStore, "getActiveUnpaidQuotes">;
  handler: QuoteObservationHandler;
  transport?: QuoteWebSocketTransport;
  transportOptions?: WebSocketQuoteTransportOptions;
  events: Pick<EventEmitter<Events>, "on">;
  now?: () => Date;
  logger?: QuoteWebSocketLogger;
}

export class DefaultQuoteWebSocketService implements QuoteWebSocketService {
  private readonly store: Pick<MintQuoteMonitoringStore, "getActiveUnpaidQuotes">;
  private readonly handler: QuoteObservationHandler;
  private readonly transport: QuoteWebSocketTransport;
  private readonly events: Pick<EventEmitter<Events>, "on">;
  private readonly now: () => Date;
  private readonly logger?: QuoteWebSocketLogger;
  private readonly unsubscribeByQuoteId = new Map<number, () => void>();
  private unsubscribeCreated?: () => void;
  private unsubscribeStateChanged?: () => void;
  private started = false;
  private stopped = false;

  constructor(options: DefaultQuoteWebSocketServiceOptions) {
    this.store = options.store;
    this.handler = options.handler;
    this.transport =
      options.transport ?? new WebSocketQuoteTransport(options.transportOptions);
    this.events = options.events;
    this.now = options.now ?? (() => new Date());
    this.logger = options.logger;
  }

  async start(): Promise<void> {
    if (this.started) return;
    if (this.stopped) throw new Error("QuoteWebSocketService has been stopped");
    this.started = true;

    this.unsubscribeCreated = this.events.on(
      "mintQuote.created",
      (quote) => this.subscribe(quote),
    );
    this.unsubscribeStateChanged = this.events.on(
      "mintQuote.stateChanged",
      ({ quote }) => {
        if (
          quote.state === "PAID" ||
          quote.state === "ISSUED" ||
          quote.state === "EXPIRED"
        ) {
          this.unsubscribeQuote(quote.id);
        }
      },
    );

    try {
      const activeQuotes = await this.store.getActiveUnpaidQuotes(this.now());
      for (const quote of activeQuotes) this.subscribe(quote);
      this.logger?.info("[QuoteWebSocketService] Restored active quotes", {
        count: activeQuotes.length,
      });
    } catch (cause) {
      this.removeEventListeners();
      this.started = false;
      throw cause;
    }
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.removeEventListeners();
    for (const unsubscribe of this.unsubscribeByQuoteId.values()) {
      unsubscribe();
    }
    this.unsubscribeByQuoteId.clear();
    this.transport.stop();
  }

  private subscribe(quote: MintQuote): void {
    if (
      !this.started ||
      this.stopped ||
      quote.state !== "UNPAID" ||
      quote.expiresAt.getTime() <= this.now().getTime() ||
      this.unsubscribeByQuoteId.has(quote.id)
    ) {
      return;
    }

    try {
      const unsubscribe = this.transport.watch(
        normalizeUrl(quote.mintUrl),
        quote.quoteId,
        async (payload) => {
          await this.handler.handle({
            source: "websocket",
            mintQuoteId: quote.id,
            payload,
          });
        },
      );
      this.unsubscribeByQuoteId.set(quote.id, unsubscribe);
    } catch (cause) {
      this.logger?.warn("[QuoteWebSocketService] Failed to subscribe quote", {
        mintUrl: normalizeUrl(quote.mintUrl),
        quoteId: quote.quoteId,
        cause,
      });
    }
  }

  private unsubscribeQuote(quoteId: number): void {
    const unsubscribe = this.unsubscribeByQuoteId.get(quoteId);
    if (!unsubscribe) return;
    this.unsubscribeByQuoteId.delete(quoteId);
    unsubscribe();
  }

  private removeEventListeners(): void {
    this.unsubscribeCreated?.();
    this.unsubscribeCreated = undefined;
    this.unsubscribeStateChanged?.();
    this.unsubscribeStateChanged = undefined;
  }
}
