import { describe, expect, test } from "bun:test";
import { SqliteAdapter } from "@/database/sqliteAdapter";
import type { QuoteBatchingSupport } from "@/domain/mint/MintService";
import { MintQuote } from "@/domain/mintQuote/MintQuote";
import type {
  BatchQuoteCheckResult,
  MintQuoteClient,
  MintQuotePayload,
  QuoteCheckResult,
} from "@/domain/mintQuoteMonitor/MintQuoteClient";
import { SqliteMintQuoteRepository } from "@/infrastructure/db/sqliteMintQuoteRepository";
import { runMigrations } from "@/migrations";
import type { TakeDueForPollingInput } from "./MintQuoteMonitoringStore";
import type { QuoteObservation } from "./QuoteObservation";
import type { QuoteObservationHandler } from "./QuoteObservationHandler";
import {
  DefaultQuotePollingService,
  type QuoteBatchingSupportProvider,
} from "./QuotePollingService";

const now = new Date("2026-08-10T12:00:00.000Z");

function quote(
  id: number,
  mintUrl = "https://mint.example.com",
  expiresAt = new Date(now.getTime() + 60_000),
): MintQuote {
  return new MintQuote({
    id,
    createdAt: new Date(now.getTime() - 1_000),
    mintUrl,
    unit: "sat",
    paymentRequest: `lnbc-${id}`,
    quoteId: `quote-${id}`,
    expiresAt,
    amount: id,
    pubkey: "pubkey",
    state: "UNPAID",
    locked: false,
  });
}

function payload(
  quoteId: string,
  state: "UNPAID" | "PAID" = "PAID",
): MintQuotePayload {
  return { quote: quoteId, request: "lnbc", state };
}

class FakeClock {
  readonly scheduled: Array<{ callback: () => void; delayMs: number }> = [];
  readonly cancelled: unknown[] = [];
  current = now;

  now(): Date {
    return this.current;
  }

  schedule(callback: () => void, delayMs: number): unknown {
    const handle = { callback, delayMs };
    this.scheduled.push(handle);
    return handle;
  }

  cancel(handle: unknown): void {
    this.cancelled.push(handle);
  }

  fireNext(): void {
    const scheduled = this.scheduled.shift();
    if (!scheduled) throw new Error("No scheduled callback");
    scheduled.callback();
  }
}

class FakeHandler implements QuoteObservationHandler {
  readonly observations: QuoteObservation[] = [];

  async handle(observation: QuoteObservation): Promise<undefined> {
    this.observations.push(observation);
    return undefined;
  }
}

class FakeClient implements MintQuoteClient {
  readonly batchCalls: Array<{
    mintUrl: string;
    quoteIds: readonly string[];
    batchSize: number;
    signal?: AbortSignal;
  }> = [];
  readonly individualCalls: Array<{
    mintUrl: string;
    quoteId: string;
    signal?: AbortSignal;
  }> = [];
  batchResult: BatchQuoteCheckResult = {
    kind: "mint_unavailable",
    cause: new Error("No batch result configured"),
  };
  individualResults = new Map<string, QuoteCheckResult>();

  async checkQuotes(
    mintUrl: string,
    quoteIds: readonly string[],
    batchSize: number,
    signal?: AbortSignal,
  ): Promise<BatchQuoteCheckResult> {
    this.batchCalls.push({ mintUrl, quoteIds, batchSize, signal });
    return this.batchResult;
  }

  async checkQuote(
    mintUrl: string,
    quoteId: string,
    signal?: AbortSignal,
  ): Promise<QuoteCheckResult> {
    this.individualCalls.push({ mintUrl, quoteId, signal });
    return (
      this.individualResults.get(quoteId) ?? {
        kind: "not_found",
        requestStartedAt: now,
      }
    );
  }
}

class FakeBatchingSupport implements QuoteBatchingSupportProvider {
  readonly calls: string[] = [];
  result: QuoteBatchingSupport = { support: true, limit: 100 };

  async supportsQuoteBatching(mintUrl: string): Promise<QuoteBatchingSupport> {
    this.calls.push(mintUrl);
    return this.result;
  }
}

function createService(input: {
  quotes?: MintQuote[];
  client?: MintQuoteClient;
  batchingSupport?: FakeBatchingSupport;
  clock?: FakeClock;
  handler?: FakeHandler;
  pollIntervalMs?: number;
}) {
  const takes: TakeDueForPollingInput[] = [];
  const clock = input.clock ?? new FakeClock();
  const handler = input.handler ?? new FakeHandler();
  const client = input.client ?? new FakeClient();
  const batchingSupport = input.batchingSupport ?? new FakeBatchingSupport();
  let returnedQuotes = false;
  const service = new DefaultQuotePollingService({
    store: {
      takeDueForPolling: async (take) => {
        takes.push(take);
        if (returnedQuotes) return [];
        returnedQuotes = true;
        return input.quotes ?? [];
      },
    },
    client,
    batchingSupport,
    handler,
    clock,
    pollIntervalMs: input.pollIntervalMs ?? 20_000,
  });
  return { service, takes, clock, handler, client, batchingSupport };
}

async function yieldToPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("QuotePollingService", () => {
  test("immediately takes a bounded due batch including expired unpaid quotes", async () => {
    const requestStartedAt = new Date(now.getTime() + 5_000);
    const expired = quote(
      1,
      "HTTPS://MINT.EXAMPLE.COM/",
      new Date(now.getTime() - 60_000),
    );
    const client = new FakeClient();
    client.batchResult = {
      kind: "found",
      checks: [
        {
          payload: payload(expired.quoteId, "UNPAID"),
          requestStartedAt,
        },
      ],
    };
    const { service, takes, handler, clock } = createService({
      quotes: [expired],
      client,
    });

    await service.start();

    expect(takes).toEqual([
      {
        dueBefore: new Date(now.getTime() - 20_000),
        polledAt: now,
        limit: 100,
      },
    ]);
    expect(handler.observations).toEqual([
      {
        source: "polling",
        mintQuoteId: expired.id,
        requestStartedAt,
        result: { kind: "found", payload: payload(expired.quoteId, "UNPAID") },
      },
    ]);
    expect(clock.scheduled[0]?.delayMs).toBe(20_000);
  });

  test("groups quotes by normalized mint and maps batch payloads to observations", async () => {
    const quotes = [
      quote(1, "HTTPS://MINT.EXAMPLE.COM/"),
      quote(2, "https://mint.example.com"),
    ];
    const client = new FakeClient();
    client.batchResult = {
      kind: "found",
      checks: quotes.map((item) => ({
        payload: payload(item.quoteId),
        requestStartedAt: now,
      })),
    };
    const { service, handler } = createService({ quotes, client });

    await service.start();

    expect(client.batchCalls).toHaveLength(1);
    expect(client.batchCalls[0]).toMatchObject({
      mintUrl: "https://mint.example.com",
      quoteIds: ["quote-1", "quote-2"],
      batchSize: 100,
    });
    expect(
      handler.observations.map((observation) => observation.mintQuoteId),
    ).toEqual([1, 2]);
  });

  test("falls back to individual checks and forwards found and not-found results", async () => {
    const quotes = [quote(1), quote(2)];
    const client = new FakeClient();
    const batchingSupport = new FakeBatchingSupport();
    batchingSupport.result = { support: false };
    client.individualResults.set("quote-1", {
      kind: "found",
      payload: payload("quote-1"),
      requestStartedAt: now,
    });
    client.individualResults.set("quote-2", {
      kind: "not_found",
      requestStartedAt: now,
    });
    const { service, handler } = createService({
      quotes,
      client,
      batchingSupport,
    });

    await service.start();

    expect(client.individualCalls.map(({ quoteId }) => quoteId)).toEqual([
      "quote-1",
      "quote-2",
    ]);
    expect(client.batchCalls).toEqual([]);
    expect(
      handler.observations.map((observation) =>
        observation.source === "polling" ? observation.result : undefined,
      ),
    ).toEqual([
      { kind: "found", payload: payload("quote-1") },
      { kind: "not_found" },
    ]);
  });

  test("lets a responsive mint finish while another mint is slow", async () => {
    let resolveSlow: ((result: BatchQuoteCheckResult) => void) | undefined;
    const slowResult = new Promise<BatchQuoteCheckResult>((resolve) => {
      resolveSlow = resolve;
    });
    const client: MintQuoteClient = {
      checkQuotes: async (mintUrl, quoteIds) =>
        mintUrl.includes("slow")
          ? slowResult
          : {
              kind: "found",
              checks: quoteIds.map((quoteId) => ({
                payload: payload(quoteId),
                requestStartedAt: now,
              })),
            },
      checkQuote: async () => ({
        kind: "not_found",
        requestStartedAt: now,
      }),
    };
    const { service, handler } = createService({
      quotes: [
        quote(1, "https://slow.example"),
        quote(2, "https://fast.example"),
      ],
      client,
    });

    const started = service.start();
    await yieldToPromises();

    expect(
      handler.observations.map((observation) => observation.mintQuoteId),
    ).toEqual([2]);
    resolveSlow?.({ kind: "mint_unavailable", cause: new Error("offline") });
    await started;
  });

  test("does not overlap rounds and aborts an in-flight request on stop", async () => {
    const clock = new FakeClock();
    let calls = 0;
    let periodicSignal: AbortSignal | undefined;
    let resolvePeriodic: ((result: BatchQuoteCheckResult) => void) | undefined;
    const client: MintQuoteClient = {
      checkQuotes: async (_mintUrl, quoteIds, _batchSize, signal) => {
        calls += 1;
        if (calls === 1) {
          return {
            kind: "found",
            checks: quoteIds.map((quoteId) => ({
              payload: payload(quoteId),
              requestStartedAt: now,
            })),
          };
        }
        periodicSignal = signal;
        return new Promise((resolve) => {
          resolvePeriodic = resolve;
          signal?.addEventListener(
            "abort",
            () => resolve({ kind: "mint_unavailable", cause: signal.reason }),
            { once: true },
          );
        });
      },
      checkQuote: async () => ({
        kind: "not_found",
        requestStartedAt: now,
      }),
    };
    const takes: TakeDueForPollingInput[] = [];
    const service = new DefaultQuotePollingService({
      store: {
        takeDueForPolling: async (take) => {
          takes.push(take);
          return [quote(1)];
        },
      },
      client,
      batchingSupport: new FakeBatchingSupport(),
      handler: new FakeHandler(),
      clock,
      pollIntervalMs: 20_000,
    });
    await service.start();

    clock.fireNext();
    await yieldToPromises();
    expect(takes).toHaveLength(2);
    expect(clock.scheduled).toHaveLength(0);

    const stopped = service.stop();
    expect(periodicSignal?.aborted).toBe(true);
    resolvePeriodic?.({
      kind: "mint_unavailable",
      cause: new Error("stopped"),
    });
    await stopped;
    expect(clock.scheduled).toHaveLength(0);
  });

  test("a failed mint request completes the round after the queue claim", async () => {
    const client = new FakeClient();
    client.batchResult = {
      kind: "mint_unavailable",
      cause: new Error("offline"),
    };
    const { service, takes, handler } = createService({
      quotes: [quote(1)],
      client,
    });

    await expect(service.start()).resolves.toBeUndefined();

    expect(takes).toHaveLength(1);
    expect(handler.observations).toEqual([]);
  });

  test("persists queue progress for active and expired quotes when a mint is unavailable", async () => {
    const adapter = new SqliteAdapter(":memory:");
    await runMigrations(adapter);
    const repository = new SqliteMintQuoteRepository(adapter);
    const active = await repository.create({
      mintUrl: "https://mint.example.com",
      paymentRequest: "lnbc-active",
      unit: "sat",
      quoteId: "active",
      expiresAt: new Date(now.getTime() + 60_000),
      amount: 1,
      pubkey: "pubkey",
      locked: false,
    });
    const expired = await repository.create({
      mintUrl: "https://mint.example.com",
      paymentRequest: "lnbc-expired",
      unit: "sat",
      quoteId: "expired",
      expiresAt: new Date(now.getTime() - 60_000),
      amount: 1,
      pubkey: "pubkey",
      locked: false,
    });
    const client = new FakeClient();
    client.batchResult = {
      kind: "mint_unavailable",
      cause: new Error("offline"),
    };
    const service = new DefaultQuotePollingService({
      store: repository,
      client,
      batchingSupport: new FakeBatchingSupport(),
      handler: new FakeHandler(),
      clock: new FakeClock(),
    });

    try {
      await service.start();

      const rows = await adapter.query<{
        id: number;
        last_polled_at: string | null;
      }>("SELECT id, last_polled_at FROM mint_quotes ORDER BY id");
      expect(rows.rows).toEqual([
        { id: active.id, last_polled_at: now.toISOString() },
        { id: expired.id, last_polled_at: now.toISOString() },
      ]);
      expect(
        await new SqliteMintQuoteRepository(adapter).takeDueForPolling({
          dueBefore: new Date(now.getTime() - 1),
          polledAt: new Date(now.getTime() + 1),
          limit: 100,
        }),
      ).toEqual([]);
      const legacyWrites = await adapter.query<{ count: number }>(
        `SELECT
           (SELECT COUNT(*) FROM mint_quote_mint_retries) +
           (SELECT COUNT(*) FROM mint_quote_reconciliation) AS count`,
      );
      expect(legacyWrites.rows[0]?.count).toBe(0);
    } finally {
      await service.stop();
      await adapter.close();
    }
  });
});
