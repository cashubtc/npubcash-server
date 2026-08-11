import type { MintQuote } from "@/domain/mintQuote/MintQuote";
import type { QuoteBatchingSupport } from "@/domain/mint/MintService";
import type { MintQuoteClient } from "@/domain/mintQuoteMonitor/MintQuoteClient";
import { normalizeUrl } from "@/utils/utils";
import type { MintQuoteMonitoringStore } from "./MintQuoteMonitoringStore";
import type { QuoteObservation } from "./QuoteObservation";
import type { QuoteObservationHandler } from "./QuoteObservationHandler";

export const DEFAULT_QUOTE_POLL_INTERVAL_MS = 20_000;
const DEFAULT_POLLING_BATCH_SIZE = 100;

interface QuotePollingLogger {
  warn(message: string, meta?: Record<string, unknown>): unknown;
}

interface QuotePollingClock {
  now(): Date;
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

interface QuotePollingServiceOptions {
  store: Pick<MintQuoteMonitoringStore, "takeDueForPolling">;
  client: MintQuoteClient;
  batchingSupport: QuoteBatchingSupportProvider;
  handler: QuoteObservationHandler;
  pollIntervalMs?: number;
  batchSize?: number;
  clock?: QuotePollingClock;
  logger?: QuotePollingLogger;
}

export interface QuoteBatchingSupportProvider {
  supportsQuoteBatching(
    mintUrl: string,
    signal?: AbortSignal,
  ): Promise<QuoteBatchingSupport>;
}

export interface QuotePollingService {
  start(): Promise<void>;
  stop(): Promise<void>;
}

const systemClock: QuotePollingClock = {
  now: () => new Date(),
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class DefaultQuotePollingService implements QuotePollingService {
  private readonly store: Pick<MintQuoteMonitoringStore, "takeDueForPolling">;
  private readonly client: MintQuoteClient;
  private readonly batchingSupport: QuoteBatchingSupportProvider;
  private readonly handler: QuoteObservationHandler;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly clock: QuotePollingClock;
  private readonly logger?: QuotePollingLogger;
  private started = false;
  private stopped = false;
  private timer?: unknown;
  private round?: Promise<void>;
  private roundController?: AbortController;

  constructor(options: QuotePollingServiceOptions) {
    this.store = options.store;
    this.client = options.client;
    this.batchingSupport = options.batchingSupport;
    this.handler = options.handler;
    this.pollIntervalMs =
      options.pollIntervalMs ?? DEFAULT_QUOTE_POLL_INTERVAL_MS;
    this.batchSize = options.batchSize ?? DEFAULT_POLLING_BATCH_SIZE;
    this.clock = options.clock ?? systemClock;
    this.logger = options.logger;

    if (!Number.isFinite(this.pollIntervalMs) || this.pollIntervalMs <= 0) {
      throw new RangeError("pollIntervalMs must be positive");
    }
    if (!Number.isInteger(this.batchSize) || this.batchSize <= 0) {
      throw new RangeError("batchSize must be a positive integer");
    }
  }

  async start(): Promise<void> {
    if (this.started) return;
    if (this.stopped) throw new Error("QuotePollingService has been stopped");
    this.started = true;

    await this.runRound();
    this.scheduleNextRound();
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer !== undefined) {
      this.clock.cancel(this.timer);
      this.timer = undefined;
    }
    this.roundController?.abort();
    try {
      await this.round;
    } catch {
      // runRound owns failure reporting; shutdown only waits for settlement.
    }
  }

  private async runRound(): Promise<void> {
    if (this.round || this.stopped) return;

    const controller = new AbortController();
    this.roundController = controller;
    const round = this.pollDueQuotes(controller.signal);
    this.round = round;

    try {
      await round;
    } catch (cause) {
      if (!controller.signal.aborted) {
        this.logger?.warn("[QuotePollingService] Polling round failed", {
          cause,
        });
      }
    } finally {
      if (this.round === round) {
        this.round = undefined;
        this.roundController = undefined;
      }
    }
  }

  private async pollDueQuotes(signal: AbortSignal): Promise<void> {
    const polledAt = this.clock.now();
    const quotes = await this.store.takeDueForPolling({
      dueBefore: new Date(polledAt.getTime() - this.pollIntervalMs),
      polledAt,
      limit: this.batchSize,
    });

    const quotesByMint = new Map<string, MintQuote[]>();
    for (const quote of quotes) {
      const mintUrl = normalizeUrl(quote.mintUrl);
      const mintQuotes = quotesByMint.get(mintUrl) ?? [];
      mintQuotes.push(quote);
      quotesByMint.set(mintUrl, mintQuotes);
    }

    const mintGroups = [...quotesByMint];
    const results = await Promise.allSettled(
      mintGroups.map(([mintUrl, mintQuotes]) =>
        this.pollMint(mintUrl, mintQuotes, signal),
      ),
    );
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      if (result.status === "rejected" && !signal.aborted) {
        this.logMintFailure(mintGroups[index][0], result.reason);
      }
    }
  }

  private async pollMint(
    mintUrl: string,
    quotes: readonly MintQuote[],
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) return;
    let support: QuoteBatchingSupport;
    try {
      support = await this.batchingSupport.supportsQuoteBatching(
        mintUrl,
        signal,
      );
    } catch (cause) {
      if (!signal.aborted) this.logMintFailure(mintUrl, cause);
      return;
    }
    if (signal.aborted) return;
    if (!support.support) {
      await this.pollIndividually(mintUrl, quotes, signal);
      return;
    }

    const result = await this.client.checkQuotes(
      mintUrl,
      quotes.map((quote) => quote.quoteId),
      support.limit,
      signal,
    );

    if (result.kind === "found") {
      if (result.checks.length !== quotes.length) {
        this.logMintFailure(
          mintUrl,
          new Error("Batch response length did not match selected quotes"),
        );
        return;
      }
      for (let index = 0; index < quotes.length; index += 1) {
        const check = result.checks[index];
        await this.forwardResult(quotes[index], check.requestStartedAt, {
          kind: "found",
          payload: check.payload,
        });
      }
      return;
    }

    if (result.kind === "mint_unavailable") {
      this.logMintFailure(mintUrl, result.cause);
      return;
    }

    if (result.kind === "invalid_response") {
      this.logMintFailure(mintUrl, result.cause);
    }
    await this.pollIndividually(mintUrl, quotes, signal);
  }

  private async pollIndividually(
    mintUrl: string,
    quotes: readonly MintQuote[],
    signal: AbortSignal,
  ): Promise<void> {
    for (const quote of quotes) {
      if (signal.aborted) return;
      const result = await this.client.checkQuote(
        mintUrl,
        quote.quoteId,
        signal,
      );
      if (result.kind === "found") {
        await this.forwardResult(quote, result.requestStartedAt, {
          kind: "found",
          payload: result.payload,
        });
      } else if (result.kind === "not_found") {
        await this.forwardResult(quote, result.requestStartedAt, {
          kind: "not_found",
        });
      } else {
        this.logMintFailure(mintUrl, result.cause, quote.quoteId);
      }
    }
  }

  private async forwardResult(
    quote: MintQuote,
    requestStartedAt: Date,
    result: Extract<QuoteObservation, { source: "polling" }>["result"],
  ): Promise<void> {
    try {
      await this.handler.handle({
        source: "polling",
        mintQuoteId: quote.id,
        requestStartedAt,
        result,
      });
    } catch (cause) {
      this.logger?.warn("[QuotePollingService] Observation failed", {
        mintUrl: normalizeUrl(quote.mintUrl),
        quoteId: quote.quoteId,
        cause,
      });
    }
  }

  private logMintFailure(
    mintUrl: string,
    cause: unknown,
    quoteId?: string,
  ): void {
    this.logger?.warn("[QuotePollingService] Mint request failed", {
      mintUrl,
      quoteId,
      cause,
    });
  }

  private scheduleNextRound(): void {
    if (this.stopped || !this.started || this.timer !== undefined) return;
    this.timer = this.clock.schedule(() => {
      this.timer = undefined;
      void this.runRound().finally(() => this.scheduleNextRound());
    }, this.pollIntervalMs);
  }
}
