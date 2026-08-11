import type { MintQuote } from "@/domain/mintQuote/MintQuote";
import type { QuoteBatchingSupport } from "@/domain/mint/MintService";
import type { MintQuoteClient } from "@/domain/mintQuoteMonitor/MintQuoteClient";
import { normalizeUrl } from "@/utils/utils";
import type {
  DueMintQueue,
  MintQuoteMonitoringStore,
} from "./MintQuoteMonitoringStore";
import type { QuoteObservation } from "./QuoteObservation";
import type { QuoteObservationHandler } from "./QuoteObservationHandler";

export const DEFAULT_QUOTE_POLL_INTERVAL_MS = 20_000;
export const DEFAULT_MAX_RESIDENT_QUOTES = 5_000;
const INDIVIDUAL_POLL_LIMIT = 10;

interface QuotePollingLogger {
  warn(message: string, meta?: Record<string, unknown>): unknown;
}

interface QuotePollingClock {
  now(): Date;
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

interface CapacityWaiter {
  limit: number;
  laneToken: symbol;
  signal: AbortSignal;
  resolve: (capacity: number) => void;
  abort: () => void;
}

interface QuotePollingServiceOptions {
  store: Pick<
    MintQuoteMonitoringStore,
    "listDueMintQueues" | "takeDueForMintPolling"
  >;
  client: MintQuoteClient;
  batchingSupport: QuoteBatchingSupportProvider;
  handler: QuoteObservationHandler;
  pollIntervalMs?: number;
  maxResidentQuotes?: number;
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
  private readonly store: Pick<
    MintQuoteMonitoringStore,
    "listDueMintQueues" | "takeDueForMintPolling"
  >;
  private readonly client: MintQuoteClient;
  private readonly batchingSupport: QuoteBatchingSupportProvider;
  private readonly handler: QuoteObservationHandler;
  private readonly pollIntervalMs: number;
  private readonly maxResidentQuotes: number;
  private readonly clock: QuotePollingClock;
  private readonly logger?: QuotePollingLogger;
  private started = false;
  private stopped = false;
  private timer?: unknown;
  private round?: Promise<void>;
  private roundController?: AbortController;
  private residentQuotes = 0;
  private readonly activeMintLanes = new Set<symbol>();
  private readonly residentQuotesByLane = new Map<symbol, number>();
  private readonly capacityWaiters: CapacityWaiter[] = [];
  private capacityDrainScheduled = false;

  constructor(options: QuotePollingServiceOptions) {
    this.store = options.store;
    this.client = options.client;
    this.batchingSupport = options.batchingSupport;
    this.handler = options.handler;
    this.pollIntervalMs =
      options.pollIntervalMs ?? DEFAULT_QUOTE_POLL_INTERVAL_MS;
    this.maxResidentQuotes =
      options.maxResidentQuotes ?? DEFAULT_MAX_RESIDENT_QUOTES;
    this.clock = options.clock ?? systemClock;
    this.logger = options.logger;

    if (!Number.isFinite(this.pollIntervalMs) || this.pollIntervalMs <= 0) {
      throw new RangeError("pollIntervalMs must be positive");
    }
    if (
      !Number.isInteger(this.maxResidentQuotes) ||
      this.maxResidentQuotes <= 0
    ) {
      throw new RangeError("maxResidentQuotes must be a positive integer");
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
    const skippedMintUrls = new Set<string>();

    while (!signal.aborted) {
      const dueBefore = new Date(
        this.clock.now().getTime() - this.pollIntervalMs,
      );
      const discoveredMintUrls = new Set<string>();
      const laneTasks = new Set<Promise<void>>();
      let foundQueue = false;

      try {
        while (!signal.aborted) {
          const availableLaneSlots = this.maxResidentQuotes - laneTasks.size;
          if (availableLaneSlots === 0) {
            await Promise.race(laneTasks);
            continue;
          }

          const queues = await this.store.listDueMintQueues({
            dueBefore,
            limit: availableLaneSlots,
            excludedMintUrls: [...skippedMintUrls, ...discoveredMintUrls],
          });
          if (signal.aborted) break;
          if (queues.length === 0) break;
          foundQueue = true;

          for (const queue of queues) {
            discoveredMintUrls.add(queue.mintUrl);
          }
          const queuedLanes = queues.map((queue) => ({
            queue,
            token: Symbol(queue.mintUrl),
          }));
          for (const { token } of queuedLanes) {
            this.activeMintLanes.add(token);
          }

          for (const { queue, token } of queuedLanes) {
            let task: Promise<void>;
            task = this.pollMintQueue(queue, token, dueBefore, signal)
              .then((claimedQuotes) => {
                if (claimedQuotes === 0) skippedMintUrls.add(queue.mintUrl);
              })
              .catch((cause) => {
                skippedMintUrls.add(queue.mintUrl);
                if (!signal.aborted) this.logMintFailure(queue.mintUrl, cause);
              })
              .finally(() => {
                laneTasks.delete(task);
                this.activeMintLanes.delete(token);
                this.scheduleCapacityDrain();
              });
            laneTasks.add(task);
          }
        }
      } finally {
        await Promise.allSettled([...laneTasks]);
      }

      if (signal.aborted || !foundQueue) return;
      const refreshedDueBefore = new Date(
        this.clock.now().getTime() - this.pollIntervalMs,
      );
      if (refreshedDueBefore <= dueBefore) return;
    }
  }

  private async pollMintQueue(
    queue: DueMintQueue,
    laneToken: symbol,
    dueBefore: Date,
    signal: AbortSignal,
  ): Promise<number> {
    if (signal.aborted) return 0;

    let support: QuoteBatchingSupport;
    try {
      support = await this.batchingSupport.supportsQuoteBatching(
        queue.mintUrl,
        signal,
      );
    } catch (cause) {
      if (!signal.aborted) this.logMintFailure(queue.mintUrl, cause);
      return 0;
    }
    if (signal.aborted) return 0;

    const requestedCapacity = support.support
      ? support.limit
      : INDIVIDUAL_POLL_LIMIT;
    let totalClaimedQuotes = 0;
    while (!signal.aborted) {
      const reservedCapacity = await this.reserveCapacity(
        requestedCapacity,
        laneToken,
        signal,
      );
      if (reservedCapacity === 0) return totalClaimedQuotes;

      let heldCapacity = reservedCapacity;
      try {
        const quotes = await this.store.takeDueForMintPolling({
          mintUrlAliases: queue.mintUrlAliases,
          dueBefore,
          polledAt: this.clock.now(),
          limit: reservedCapacity,
        });
        totalClaimedQuotes += quotes.length;
        this.releaseCapacity(reservedCapacity - quotes.length, laneToken);
        heldCapacity = quotes.length;
        if (quotes.length === 0 || signal.aborted) return totalClaimedQuotes;

        if (support.support) {
          await this.pollBatch(queue.mintUrl, quotes, support.limit, signal);
        } else {
          await this.pollIndividually(queue.mintUrl, quotes, signal);
        }
      } finally {
        this.releaseCapacity(heldCapacity, laneToken);
      }
    }

    return totalClaimedQuotes;
  }

  private async pollBatch(
    mintUrl: string,
    quotes: readonly MintQuote[],
    batchSize: number,
    signal: AbortSignal,
  ): Promise<void> {
    const result = await this.client.checkQuotes(
      mintUrl,
      quotes.map((quote) => quote.quoteId),
      batchSize,
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
    await this.pollIndividually(
      mintUrl,
      quotes.slice(0, INDIVIDUAL_POLL_LIMIT),
      signal,
    );
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

  private reserveCapacity(
    limit: number,
    laneToken: symbol,
    signal: AbortSignal,
  ): Promise<number> {
    if (signal.aborted) return Promise.resolve(0);

    return new Promise<number>((resolve) => {
      const waiter: CapacityWaiter = {
        limit,
        laneToken,
        signal,
        resolve,
        abort: () => {
          const index = this.capacityWaiters.indexOf(waiter);
          if (index >= 0) this.capacityWaiters.splice(index, 1);
          resolve(0);
          this.scheduleCapacityDrain();
        },
      };
      this.capacityWaiters.push(waiter);
      signal.addEventListener("abort", waiter.abort, { once: true });
      this.scheduleCapacityDrain();
    });
  }

  private releaseCapacity(capacity: number, laneToken: symbol): void {
    if (capacity <= 0) return;
    this.residentQuotes = Math.max(0, this.residentQuotes - capacity);
    const laneCapacity = Math.max(
      0,
      (this.residentQuotesByLane.get(laneToken) ?? 0) - capacity,
    );
    if (laneCapacity === 0) {
      this.residentQuotesByLane.delete(laneToken);
    } else {
      this.residentQuotesByLane.set(laneToken, laneCapacity);
    }
    this.scheduleCapacityDrain();
  }

  private scheduleCapacityDrain(): void {
    if (this.capacityDrainScheduled) return;
    this.capacityDrainScheduled = true;
    queueMicrotask(() => {
      this.capacityDrainScheduled = false;
      this.drainCapacity();
    });
  }

  private drainCapacity(): void {
    for (let index = this.capacityWaiters.length - 1; index >= 0; index -= 1) {
      const waiter = this.capacityWaiters[index];
      if (!waiter.signal.aborted) continue;
      this.capacityWaiters.splice(index, 1);
      waiter.signal.removeEventListener("abort", waiter.abort);
      waiter.resolve(0);
    }

    const available = this.maxResidentQuotes - this.residentQuotes;
    if (available <= 0 || this.capacityWaiters.length === 0) return;

    const representedLanes = new Set([
      ...this.residentQuotesByLane.keys(),
      ...this.capacityWaiters.map(({ laneToken }) => laneToken),
    ]);
    let unreadyLaneReservations = 0;
    for (const laneToken of this.activeMintLanes) {
      if (!representedLanes.has(laneToken)) unreadyLaneReservations += 1;
    }
    const allocatable = available - unreadyLaneReservations;
    if (allocatable <= 0) return;

    const waiters = this.capacityWaiters.splice(
      0,
      Math.min(this.capacityWaiters.length, allocatable),
    );
    const allocations = new Map<CapacityWaiter, number>(
      waiters.map((waiter) => [waiter, 0]),
    );
    let remaining = allocatable;
    let unfilled = waiters;

    while (remaining > 0 && unfilled.length > 0) {
      const share = Math.max(1, Math.floor(remaining / unfilled.length));
      const next: CapacityWaiter[] = [];
      for (const waiter of unfilled) {
        const allocated = allocations.get(waiter) ?? 0;
        const granted = Math.min(waiter.limit - allocated, share, remaining);
        allocations.set(waiter, allocated + granted);
        remaining -= granted;
        if (allocated + granted < waiter.limit) next.push(waiter);
        if (remaining === 0) break;
      }
      unfilled = next;
    }

    for (const waiter of waiters) {
      waiter.signal.removeEventListener("abort", waiter.abort);
      if (waiter.signal.aborted) {
        waiter.resolve(0);
        continue;
      }
      const granted = allocations.get(waiter) ?? 0;
      this.residentQuotes += granted;
      this.residentQuotesByLane.set(
        waiter.laneToken,
        (this.residentQuotesByLane.get(waiter.laneToken) ?? 0) + granted,
      );
      waiter.resolve(granted);
    }
  }

  private scheduleNextRound(): void {
    if (this.stopped || !this.started || this.timer !== undefined) return;
    this.timer = this.clock.schedule(() => {
      this.timer = undefined;
      void this.runRound().finally(() => this.scheduleNextRound());
    }, this.pollIntervalMs);
  }
}
