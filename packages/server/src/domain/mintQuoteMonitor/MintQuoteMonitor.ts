import { MintQuote } from "@/domain/mintQuote/MintQuote";
import { normalizeUrl } from "@/utils/utils";
import type {
  BatchQuoteCheckResult,
  MintQuoteClient,
  MintQuotePayload,
  QuoteCheckResult,
} from "./MintQuoteClient";
import type {
  MintQuoteMonitorStore,
  MintRetryErrorCategory,
  MintRetryState,
  QuoteCheckCategory,
} from "./MintQuoteMonitorStore";

export interface MintQuoteMonitor {
  start(): Promise<void>;
  watch(quote: MintQuote): Promise<void>;
  stop(): Promise<void>;
}

export interface ActiveQuoteTransport {
  watch(
    mintUrl: string,
    quoteId: string,
    onPayload: (payload: MintQuotePayload) => void | Promise<void>,
  ): () => void;
  stop(): void;
}

export interface MonitorClock {
  now(): Date;
  schedule(
    callback: () => void | Promise<void>,
    delayMs: number,
  ): unknown;
  cancel(handle: unknown): void;
}

export interface MintQuoteMonitorPolicy {
  activePollIntervalMs: number;
  activeRetryMs: readonly number[];
  reconciliationRetryMs: readonly number[];
  notFoundInitialMs: number;
  notFoundMaxMs: number;
  jitterRatio: number;
}

interface MonitorLogger {
  debug(message: string, meta?: Record<string, unknown>): unknown;
  info(message: string, meta?: Record<string, unknown>): unknown;
  warn(message: string, meta?: Record<string, unknown>): unknown;
  error(message: string, meta?: Record<string, unknown>): unknown;
}

interface DefaultMintQuoteMonitorOptions {
  store: MintQuoteMonitorStore;
  client: MintQuoteClient;
  activeTransport: ActiveQuoteTransport;
  clock?: MonitorClock;
  policy?: Partial<MintQuoteMonitorPolicy>;
  random?: () => number;
  logger?: MonitorLogger;
  onPaid?: (quote: MintQuote) => void | Promise<void>;
}

type QuotePhase = "active" | "reconciliation";

interface WatchedQuote {
  quote: MintQuote;
  mintUrl: string;
  phase: QuotePhase;
  activated: boolean;
  nextCheckAt?: number;
  expiryTimer?: unknown;
  unsubscribeActive?: () => void;
  notFoundCount: number;
  invalidResponseCount: number;
}

interface MintSession {
  mintUrl: string;
  quoteIds: Set<number>;
  retry?: MintRetryState;
  timer?: unknown;
  inFlight?: { quoteId: number; controller: AbortController };
  running: boolean;
  cursor: number;
}

export const DEFAULT_MINT_QUOTE_MONITOR_POLICY: MintQuoteMonitorPolicy = {
  activePollIntervalMs: 20_000,
  activeRetryMs: [5_000, 10_000, 30_000, 60_000],
  reconciliationRetryMs: [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000],
  notFoundInitialMs: 3_600_000,
  notFoundMaxMs: 86_400_000,
  jitterRatio: 0.2,
};

const systemClock: MonitorClock = {
  now: () => new Date(),
  schedule: (callback, delayMs) =>
    setTimeout(() => {
      void callback();
    }, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class DefaultMintQuoteMonitor implements MintQuoteMonitor {
  private readonly store: MintQuoteMonitorStore;
  private readonly client: MintQuoteClient;
  private readonly activeTransport: ActiveQuoteTransport;
  private readonly clock: MonitorClock;
  private readonly policy: MintQuoteMonitorPolicy;
  private readonly random: () => number;
  private readonly logger?: MonitorLogger;
  private readonly onPaid?: (quote: MintQuote) => void | Promise<void>;
  private readonly quotes = new Map<number, WatchedQuote>();
  private readonly sessions = new Map<string, MintSession>();
  private readonly sessionLoads = new Map<string, Promise<MintSession>>();
  private started = false;
  private stopped = false;
  private restoring = false;
  private startupController?: AbortController;

  constructor(options: DefaultMintQuoteMonitorOptions) {
    this.store = options.store;
    this.client = options.client;
    this.activeTransport = options.activeTransport;
    this.clock = options.clock ?? systemClock;
    this.policy = {
      ...DEFAULT_MINT_QUOTE_MONITOR_POLICY,
      ...options.policy,
    };
    this.random = options.random ?? Math.random;
    this.logger = options.logger;
    this.onPaid = options.onPaid;
  }

  async start(): Promise<void> {
    if (this.started) return;
    if (this.stopped) throw new Error("MintQuoteMonitor has been stopped");
    this.started = true;

    const recoverable = await this.store.getRecoverableQuotes();
    this.restoring = true;
    try {
      for (const quote of recoverable) {
        await this.registerQuote(quote, false);
      }
      await this.reconcileStartupBatches();
    } finally {
      this.restoring = false;
    }
    if (this.stopped) return;
    for (const session of this.sessions.values()) {
      this.rescheduleSession(session);
    }

    const now = this.clock.now().getTime();
    const watched = [...this.quotes.values()];
    const active = watched.filter((entry) => entry.phase === "active").length;
    const reconciliationDue = watched.filter(
      (entry) =>
        entry.phase === "reconciliation" &&
        (entry.nextCheckAt ?? Number.POSITIVE_INFINITY) <= now,
    ).length;
    this.logger?.info("[QuoteMonitor] Restored recoverable quotes", {
      active,
      reconciliationDue,
      deferred: watched.length - active - reconciliationDue,
      resolvedAtStartup: recoverable.length - watched.length,
    });
  }

  private async reconcileStartupBatches(): Promise<void> {
    const controller = new AbortController();
    this.startupController = controller;
    try {
      await Promise.all(
        [...this.sessions.values()].map((session) =>
          this.reconcileAndActivateStartupSession(session, controller.signal),
        ),
      );
    } finally {
      if (this.startupController === controller) {
        this.startupController = undefined;
      }
    }
  }

  private async reconcileAndActivateStartupSession(
    session: MintSession,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      if (this.stopped) return;
      const now = this.clock.now().getTime();
      if (session.retry && session.retry.nextAttemptAt.getTime() > now) return;

      const entries = [...session.quoteIds]
        .map((id) => this.quotes.get(id))
        .filter(
          (entry): entry is WatchedQuote =>
            entry !== undefined &&
            entry.nextCheckAt !== undefined &&
            entry.nextCheckAt <= now,
        );
      if (entries.length === 0) return;

      const result = await this.client.checkQuotes(
        session.mintUrl,
        entries.map((entry) => entry.quote.quoteId),
        signal,
      );
      if (this.stopped) return;
      await this.handleStartupBatchResult(session, entries, result);
    } catch (cause) {
      if (!this.stopped) {
        try {
          await this.openCircuit(session, "mint_unavailable");
        } catch (persistCause) {
          this.logger?.error(
            "[QuoteMonitor] Unexpected startup check failure",
            { mintUrl: session.mintUrl, cause, persistCause },
          );
        }
      }
    } finally {
      for (const id of [...session.quoteIds]) {
        const entry = this.quotes.get(id);
        if (entry) await this.activateQuote(entry);
      }
    }
  }

  private async handleStartupBatchResult(
    session: MintSession,
    entries: WatchedQuote[],
    result: BatchQuoteCheckResult,
  ): Promise<void> {
    if (result.kind === "unsupported") {
      this.logger?.debug(
        "[QuoteMonitor] Mint does not advertise NUT-29; using individual startup checks",
        { mintUrl: session.mintUrl, count: entries.length },
      );
      return;
    }
    if (result.kind === "invalid_response") {
      this.logger?.warn(
        "[QuoteMonitor] NUT-29 startup check failed; using individual checks",
        { mintUrl: session.mintUrl, count: entries.length, cause: result.cause },
      );
      return;
    }
    if (result.kind === "mint_unavailable") {
      try {
        await this.openCircuit(session, "mint_unavailable");
      } catch (cause) {
        this.logger?.error(
          "[QuoteMonitor] Failed to persist startup batch retry",
          { mintUrl: session.mintUrl, cause },
        );
      }
      return;
    }

    this.logger?.info("[QuoteMonitor] Reconciled startup quotes with NUT-29", {
      mintUrl: session.mintUrl,
      count: entries.length,
    });
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      if (this.quotes.get(entry.quote.id) !== entry) continue;
      try {
        await this.handleCheckResult(session, entry, {
          kind: "found",
          payload: result.payloads[index]!,
        });
      } catch (cause) {
        this.logger?.error(
          "[QuoteMonitor] Startup batch result handling failed",
          { mintUrl: entry.mintUrl, quoteId: entry.quote.quoteId, cause },
        );
      }
    }
  }

  async watch(quote: MintQuote): Promise<void> {
    await this.registerQuote(quote, true);
  }

  private async registerQuote(
    quote: MintQuote,
    activate: boolean,
  ): Promise<void> {
    if (this.stopped) throw new Error("MintQuoteMonitor has been stopped");
    if (quote.state !== "UNPAID" || this.quotes.has(quote.id)) return;

    const mintUrl = normalizeUrl(quote.mintUrl);
    const session = await this.getOrCreateSession(mintUrl);
    if (this.stopped || this.quotes.has(quote.id)) return;

    const now = this.clock.now().getTime();
    const phase: QuotePhase =
      quote.expiresAt.getTime() <= now ? "reconciliation" : "active";
    const metadata = await this.store.getQuoteReconciliationState(quote.id);
    const entry: WatchedQuote = {
      quote,
      mintUrl,
      phase,
      activated: false,
      notFoundCount: metadata?.notFoundCount ?? 0,
      invalidResponseCount: 0,
    };
    this.quotes.set(quote.id, entry);
    session.quoteIds.add(quote.id);

    if (phase === "active") {
      entry.nextCheckAt = metadata?.nextCheckAt.getTime() ?? now;
    } else {
      entry.nextCheckAt = metadata?.nextCheckAt.getTime() ?? now;
      if (!metadata) {
        await this.store.saveQuoteReconciliationState({
          mintQuoteId: quote.id,
          nextCheckAt: new Date(entry.nextCheckAt),
          notFoundCount: 0,
          lastResult: "scheduled",
        });
      }
    }
    if (activate) {
      await this.activateQuote(entry);
      this.rescheduleSession(session);
    }
  }

  private async activateQuote(entry: WatchedQuote): Promise<void> {
    if (
      entry.activated ||
      this.stopped ||
      this.quotes.get(entry.quote.id) !== entry
    ) {
      return;
    }
    entry.activated = true;
    if (entry.phase !== "active") return;

    const now = this.clock.now().getTime();
    if (entry.quote.expiresAt.getTime() <= now) {
      await this.enterReconciliation(entry.quote.id);
      return;
    }
    try {
      entry.unsubscribeActive = this.activeTransport.watch(
        entry.mintUrl,
        entry.quote.quoteId,
        (payload) => this.handlePayload(entry.quote.id, payload),
      );
    } catch (cause) {
      this.logger?.warn(
        "[QuoteMonitor] WebSocket watch failed; HTTP fallback remains active",
        {
          mintUrl: entry.mintUrl,
          quoteId: entry.quote.quoteId,
          cause,
        },
      );
    }
    entry.expiryTimer = this.clock.schedule(
      () => this.enterReconciliation(entry.quote.id),
      entry.quote.expiresAt.getTime() - now,
    );
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    for (const entry of this.quotes.values()) {
      if (entry.expiryTimer !== undefined) {
        this.clock.cancel(entry.expiryTimer);
      }
      entry.unsubscribeActive?.();
    }
    for (const session of this.sessions.values()) {
      if (session.timer !== undefined) this.clock.cancel(session.timer);
      session.inFlight?.controller.abort();
    }
    this.startupController?.abort();
    this.quotes.clear();
    this.sessions.clear();
    this.sessionLoads.clear();
    this.activeTransport.stop();
  }

  private async getOrCreateSession(mintUrl: string): Promise<MintSession> {
    const existing = this.sessions.get(mintUrl);
    if (existing) return existing;
    const loading = this.sessionLoads.get(mintUrl);
    if (loading) return loading;

    const promise = (async () => {
      const session: MintSession = {
        mintUrl,
        quoteIds: new Set(),
        retry: await this.store.getMintRetryState(mintUrl),
        running: false,
        cursor: 0,
      };
      this.sessions.set(mintUrl, session);
      this.sessionLoads.delete(mintUrl);
      return session;
    })();
    this.sessionLoads.set(mintUrl, promise);
    return promise;
  }

  private async enterReconciliation(quoteId: number): Promise<void> {
    const entry = this.quotes.get(quoteId);
    if (!entry || entry.phase === "reconciliation" || this.stopped) return;

    entry.phase = "reconciliation";
    entry.expiryTimer = undefined;
    entry.unsubscribeActive?.();
    entry.unsubscribeActive = undefined;
    entry.notFoundCount = 0;
    entry.nextCheckAt = this.clock.now().getTime();
    try {
      await this.store.saveQuoteReconciliationState({
        mintQuoteId: quoteId,
        nextCheckAt: new Date(entry.nextCheckAt),
        notFoundCount: 0,
        lastResult: "scheduled",
      });
    } catch (cause) {
      this.logger?.error(
        "[QuoteMonitor] Failed to persist reconciliation phase",
        { mintUrl: entry.mintUrl, quoteId: entry.quote.quoteId, cause },
      );
    }
    const session = this.sessions.get(entry.mintUrl);
    if (session) this.rescheduleSession(session);
  }

  private rescheduleSession(session: MintSession): void {
    if (this.stopped || this.restoring || session.running) return;
    if (session.timer !== undefined) {
      this.clock.cancel(session.timer);
      session.timer = undefined;
    }

    const dueTimes = [...session.quoteIds]
      .map((id) => this.quotes.get(id)?.nextCheckAt)
      .filter((due): due is number => due !== undefined);
    if (dueTimes.length === 0) return;

    let nextAt = Math.min(...dueTimes);
    const circuitAt = session.retry?.nextAttemptAt.getTime();
    if (circuitAt !== undefined && circuitAt > nextAt) nextAt = circuitAt;
    const delay = Math.max(0, nextAt - this.clock.now().getTime());
    session.timer = this.clock.schedule(() => this.drainMint(session), delay);
  }

  private async drainMint(session: MintSession): Promise<void> {
    if (this.stopped || session.running || !this.sessions.has(session.mintUrl)) {
      return;
    }
    session.timer = undefined;
    session.running = true;

    try {
      while (!this.stopped) {
        const now = this.clock.now().getTime();
        if (
          session.retry &&
          session.retry.nextAttemptAt.getTime() > now
        ) {
          break;
        }
        const entry = this.nextDueQuote(session, now);
        if (!entry) break;
        entry.nextCheckAt = undefined;

        let result: QuoteCheckResult;
        const controller = new AbortController();
        session.inFlight = { quoteId: entry.quote.id, controller };
        try {
          result = await this.client.checkQuote(
            entry.mintUrl,
            entry.quote.quoteId,
            controller.signal,
          );
        } catch (cause) {
          result = { kind: "mint_unavailable", cause };
        } finally {
          if (session.inFlight?.controller === controller) {
            session.inFlight = undefined;
          }
        }
        if (this.stopped || this.quotes.get(entry.quote.id) !== entry) continue;

        let continueDraining = false;
        try {
          continueDraining = await this.handleCheckResult(
            session,
            entry,
            result,
          );
        } catch (cause) {
          if (
            this.quotes.get(entry.quote.id) === entry &&
            entry.nextCheckAt === undefined
          ) {
            const delay =
              entry.phase === "active"
                ? this.policy.activeRetryMs[0]!
                : this.policy.reconciliationRetryMs[0]!;
            entry.nextCheckAt = this.clock.now().getTime() + delay;
          }
          this.logger?.error("[QuoteMonitor] Quote check handling failed", {
            mintUrl: entry.mintUrl,
            quoteId: entry.quote.quoteId,
            cause,
          });
        }
        if (!continueDraining) break;
      }
    } finally {
      session.running = false;
      if (this.sessions.get(session.mintUrl) === session) {
        this.rescheduleSession(session);
      }
    }
  }

  private nextDueQuote(
    session: MintSession,
    now: number,
  ): WatchedQuote | undefined {
    const ids = [...session.quoteIds];
    if (ids.length === 0) return undefined;
    for (let offset = 0; offset < ids.length; offset += 1) {
      const index = (session.cursor + offset) % ids.length;
      const entry = this.quotes.get(ids[index]!);
      if (entry?.nextCheckAt !== undefined && entry.nextCheckAt <= now) {
        session.cursor = (index + 1) % ids.length;
        return entry;
      }
    }
    return undefined;
  }

  private async handleCheckResult(
    session: MintSession,
    entry: WatchedQuote,
    result: QuoteCheckResult,
  ): Promise<boolean> {
    if (result.kind === "mint_unavailable") {
      entry.nextCheckAt = this.clock.now().getTime();
      await this.openCircuit(session, "mint_unavailable");
      return false;
    }

    await this.markMintReachable(session);
    if (result.kind === "not_found") {
      await this.deferNotFound(entry);
      return true;
    }
    if (result.kind === "invalid_response") {
      await this.deferInvalidResponse(entry);
      return true;
    }

    await this.processPayload(entry, result.payload);
    return true;
  }

  private async openCircuit(
    session: MintSession,
    category: MintRetryErrorCategory,
  ): Promise<void> {
    const now = this.clock.now();
    const failureCount = (session.retry?.failureCount ?? 0) + 1;
    const hasActiveQuotes = [...session.quoteIds].some(
      (id) => this.quotes.get(id)?.phase === "active",
    );
    const schedule = hasActiveQuotes
      ? this.policy.activeRetryMs
      : this.policy.reconciliationRetryMs;
    const baseDelay = schedule[Math.min(failureCount - 1, schedule.length - 1)]!;
    const retry: MintRetryState = {
      mintUrl: session.mintUrl,
      failureCount,
      nextAttemptAt: new Date(now.getTime() + this.withJitter(baseDelay)),
      lastFailureAt: now,
      lastErrorCategory: category,
    };
    session.retry = retry;
    await this.store.saveMintRetryState(retry);
    this.logger?.warn("[QuoteMonitor] Mint circuit opened", {
      mintUrl: session.mintUrl,
      failureCount,
      nextAttemptAt: retry.nextAttemptAt.toISOString(),
      category,
    });
  }

  private async markMintReachable(session: MintSession): Promise<void> {
    if (!session.retry) return;
    const failureCount = session.retry.failureCount;
    session.retry = undefined;
    try {
      await this.store.clearMintRetryState(session.mintUrl);
    } catch (cause) {
      this.logger?.warn("[QuoteMonitor] Failed to clear recovered mint circuit", {
        mintUrl: session.mintUrl,
        cause,
      });
    }
    this.logger?.info("[QuoteMonitor] Mint recovered", {
      mintUrl: session.mintUrl,
      failureCount,
    });
  }

  private async deferNotFound(entry: WatchedQuote): Promise<void> {
    entry.notFoundCount += 1;
    const base = Math.min(
      this.policy.notFoundMaxMs,
      this.policy.notFoundInitialMs * 2 ** (entry.notFoundCount - 1),
    );
    entry.nextCheckAt = this.clock.now().getTime() + this.withJitter(base);
    await this.saveQuoteCheck(entry, "not_found");
    this.logger?.info("[QuoteMonitor] Quote not found; retry deferred", {
      mintUrl: entry.mintUrl,
      quoteId: entry.quote.quoteId,
      notFoundCount: entry.notFoundCount,
      nextCheckAt: new Date(entry.nextCheckAt).toISOString(),
    });
  }

  private async deferInvalidResponse(entry: WatchedQuote): Promise<void> {
    entry.invalidResponseCount += 1;
    const schedule =
      entry.phase === "active"
        ? this.policy.activeRetryMs
        : this.policy.reconciliationRetryMs;
    const delay = schedule[
      Math.min(entry.invalidResponseCount - 1, schedule.length - 1)
    ]!;
    entry.nextCheckAt = this.clock.now().getTime() + this.withJitter(delay);
    await this.saveQuoteCheck(entry, "invalid_response");
    this.logger?.warn("[QuoteMonitor] Invalid quote response; retry deferred", {
      mintUrl: entry.mintUrl,
      quoteId: entry.quote.quoteId,
      nextCheckAt: new Date(entry.nextCheckAt).toISOString(),
    });
  }

  private async handlePayload(
    quoteId: number,
    payload: MintQuotePayload,
  ): Promise<void> {
    const entry = this.quotes.get(quoteId);
    if (!entry || this.stopped) return;
    await this.processPayload(entry, payload);
    const session = this.sessions.get(entry.mintUrl);
    if (session) this.rescheduleSession(session);
  }

  private async processPayload(
    entry: WatchedQuote,
    payload: MintQuotePayload,
  ): Promise<void> {
    if (payload.quote !== entry.quote.quoteId) {
      await this.deferInvalidResponse(entry);
      return;
    }

    const now = this.clock.now();
    if (payload.state === "PAID") {
      const paid = await this.store.transitionUnpaidQuote(
        entry.quote.id,
        "PAID",
        now,
      );
      await this.finishQuote(entry);
      if (paid && this.onPaid) {
        try {
          await this.onPaid(paid);
        } catch (cause) {
          this.logger?.error("[QuoteMonitor] Paid quote callback failed", {
            quoteId: paid.quoteId,
            cause,
          });
        }
      }
      return;
    }

    if (payload.state === "ISSUED") {
      const issued = await this.store.transitionUnpaidQuote(
        entry.quote.id,
        "ISSUED",
      );
      await this.finishQuote(entry);
      if (issued) {
        this.logger?.info("[QuoteMonitor] Quote reconciled as issued", {
          mintUrl: entry.mintUrl,
          quoteId: entry.quote.quoteId,
        });
      }
      return;
    }

    const payloadExpired =
      payload.expiry > 0 && now.getTime() >= payload.expiry * 1_000;
    const storedExpiryPassed = now.getTime() >= entry.quote.expiresAt.getTime();
    if (
      payload.state === "UNPAID" &&
      (entry.phase === "reconciliation" ||
        storedExpiryPassed ||
        payloadExpired)
    ) {
      const expired = await this.store.transitionUnpaidQuote(
        entry.quote.id,
        "EXPIRED",
      );
      await this.finishQuote(entry);
      if (expired) {
        this.logger?.info("[QuoteMonitor] Quote reconciled as expired", {
          mintUrl: entry.mintUrl,
          quoteId: entry.quote.quoteId,
        });
      }
      return;
    }

    entry.notFoundCount = 0;
    entry.invalidResponseCount = 0;
    const delay =
      entry.phase === "active"
        ? this.policy.activePollIntervalMs
        : this.policy.reconciliationRetryMs[0]!;
    entry.nextCheckAt = now.getTime() + this.withJitter(delay);
    if (entry.phase === "reconciliation") {
      await this.saveQuoteCheck(
        entry,
        payload.state === "PENDING" ? "pending" : "unpaid",
      );
    } else {
      await this.store.clearQuoteReconciliationState(entry.quote.id);
    }
  }

  private async saveQuoteCheck(
    entry: WatchedQuote,
    result: QuoteCheckCategory,
  ): Promise<void> {
    if (entry.nextCheckAt === undefined) return;
    await this.store.saveQuoteReconciliationState({
      mintQuoteId: entry.quote.id,
      lastCheckedAt: this.clock.now(),
      nextCheckAt: new Date(entry.nextCheckAt),
      notFoundCount: entry.notFoundCount,
      lastResult: result,
    });
  }

  private async finishQuote(entry: WatchedQuote): Promise<void> {
    if (this.quotes.get(entry.quote.id) !== entry) return;
    this.quotes.delete(entry.quote.id);
    const session = this.sessions.get(entry.mintUrl);
    if (session?.inFlight?.quoteId === entry.quote.id) {
      session.inFlight.controller.abort();
    }
    if (entry.expiryTimer !== undefined) this.clock.cancel(entry.expiryTimer);
    entry.unsubscribeActive?.();
    try {
      await this.store.clearQuoteReconciliationState(entry.quote.id);
    } catch (cause) {
      this.logger?.warn("[QuoteMonitor] Failed to clear terminal quote metadata", {
        mintUrl: entry.mintUrl,
        quoteId: entry.quote.quoteId,
        cause,
      });
    }

    if (!session) return;
    session.quoteIds.delete(entry.quote.id);
    if (session.quoteIds.size === 0) {
      if (session.timer !== undefined) this.clock.cancel(session.timer);
      this.sessions.delete(entry.mintUrl);
    }
  }

  private withJitter(delayMs: number): number {
    if (delayMs <= 0 || this.policy.jitterRatio <= 0) return delayMs;
    const spread = (this.random() * 2 - 1) * this.policy.jitterRatio;
    return Math.max(0, Math.round(delayMs * (1 + spread)));
  }
}
