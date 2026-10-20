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
import { normalizeUrl } from "@/utils/utils";
import type {
  DueMintQueue,
  ListDueMintQueuesInput,
  TakeDueForMintPollingInput,
} from "./MintQuoteMonitoringStore";
import type { QuoteObservation } from "./QuoteObservation";
import {
  DefaultQuoteObservationHandler,
  type QuoteObservationHandler,
} from "./QuoteObservationHandler";
import {
  DEFAULT_MAX_RESIDENT_QUOTES,
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

function quotes(
  count: number,
  mintUrl = "https://mint.example.com",
  startId = 1,
): MintQuote[] {
  return Array.from({ length: count }, (_, index) =>
    quote(startId + index, mintUrl),
  );
}

function payload(
  quoteId: string,
  state: "UNPAID" | "PAID" = "PAID",
): MintQuotePayload {
  return { quote: quoteId, request: "lnbc", state };
}

function foundBatch(quoteIds: readonly string[]): BatchQuoteCheckResult {
  return {
    kind: "found",
    checks: quoteIds.map((quoteId) => ({
      payload: payload(quoteId),
      requestStartedAt: now,
    })),
  };
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

interface FakeLane {
  mintUrl: string;
  mintUrlAliases: string[];
  quotes: MintQuote[];
}

class FakeStore {
  readonly listCalls: ListDueMintQueuesInput[] = [];
  readonly claimCalls: TakeDueForMintPollingInput[] = [];
  readonly lanes = new Map<string, FakeLane>();

  constructor(initialQuotes: readonly MintQuote[] = []) {
    this.addQuotes(initialQuotes);
  }

  addQuotes(items: readonly MintQuote[]): void {
    for (const item of items) {
      const mintUrl = normalizeUrl(item.mintUrl);
      const lane = this.lanes.get(mintUrl) ?? {
        mintUrl,
        mintUrlAliases: [],
        quotes: [],
      };
      if (!lane.mintUrlAliases.includes(item.mintUrl)) {
        lane.mintUrlAliases.push(item.mintUrl);
      }
      lane.quotes.push(item);
      this.lanes.set(mintUrl, lane);
    }
  }

  async listDueMintQueues(
    input: ListDueMintQueuesInput,
  ): Promise<DueMintQueue[]> {
    this.listCalls.push(input);
    return [...this.lanes.values()]
      .filter((lane) => lane.quotes.length > 0)
      .filter((lane) => !input.excludedMintUrls.includes(lane.mintUrl))
      .map((lane) => ({
        mintUrl: lane.mintUrl,
        mintUrlAliases: lane.mintUrlAliases,
        oldestDueAt: null,
      }))
      .slice(0, input.limit);
  }

  async takeDueForMintPolling(
    input: TakeDueForMintPollingInput,
  ): Promise<MintQuote[]> {
    this.claimCalls.push(input);
    const lane = [...this.lanes.values()].find((candidate) =>
      candidate.mintUrlAliases.some((alias) =>
        input.mintUrlAliases.includes(alias),
      ),
    );
    return lane?.quotes.splice(0, input.limit) ?? [];
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
  batchResult?: (
    mintUrl: string,
    quoteIds: readonly string[],
    signal?: AbortSignal,
  ) => Promise<BatchQuoteCheckResult> | BatchQuoteCheckResult;
  individualResults = new Map<string, QuoteCheckResult>();

  async checkQuotes(
    mintUrl: string,
    quoteIds: readonly string[],
    batchSize: number,
    signal?: AbortSignal,
  ): Promise<BatchQuoteCheckResult> {
    this.batchCalls.push({ mintUrl, quoteIds, batchSize, signal });
    return (
      this.batchResult?.(mintUrl, quoteIds, signal) ?? foundBatch(quoteIds)
    );
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
  readonly results = new Map<string, QuoteBatchingSupport | Error>();
  defaultResult: QuoteBatchingSupport = { support: true, limit: 100 };

  async supportsQuoteBatching(mintUrl: string): Promise<QuoteBatchingSupport> {
    this.calls.push(mintUrl);
    const result = this.results.get(mintUrl) ?? this.defaultResult;
    if (result instanceof Error) throw result;
    return result;
  }
}

class FakeLogger {
  readonly debugEntries: Array<{
    message: string;
    meta?: Record<string, unknown>;
  }> = [];
  readonly warningEntries: Array<{
    message: string;
    meta?: Record<string, unknown>;
  }> = [];

  debug(message: string, meta?: Record<string, unknown>): void {
    this.debugEntries.push({ message, meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.warningEntries.push({ message, meta });
  }
}

function createService(input: {
  quotes?: readonly MintQuote[];
  store?: FakeStore;
  client?: MintQuoteClient;
  batchingSupport?: QuoteBatchingSupportProvider;
  clock?: FakeClock;
  handler?: FakeHandler;
  pollIntervalMs?: number;
  maxResidentQuotes?: number;
  logger?: FakeLogger;
}) {
  const store = input.store ?? new FakeStore(input.quotes);
  const clock = input.clock ?? new FakeClock();
  const handler = input.handler ?? new FakeHandler();
  const client = input.client ?? new FakeClient();
  const batchingSupport = input.batchingSupport ?? new FakeBatchingSupport();
  const service = new DefaultQuotePollingService({
    store,
    client,
    batchingSupport,
    handler,
    clock,
    pollIntervalMs: input.pollIntervalMs ?? 20_000,
    maxResidentQuotes: input.maxResidentQuotes,
    logger: input.logger,
  });
  return { service, store, clock, handler, client, batchingSupport };
}

async function yieldToPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe("QuotePollingService", () => {
  test("logs polling lifecycle, queue discovery, claims, and round totals", async () => {
    const logger = new FakeLogger();
    const { service } = createService({
      quotes: quotes(2),
      logger,
    });

    await service.start();
    await service.stop();

    expect(logger.debugEntries).toEqual([
      {
        message: "[QuotePollingService] Polling started",
        meta: {
          pollIntervalMs: 20_000,
          maxResidentQuotes: DEFAULT_MAX_RESIDENT_QUOTES,
        },
      },
      {
        message: "[QuotePollingService] Polling round started",
        meta: { dueBefore: "2026-08-10T11:59:40.000Z" },
      },
      {
        message: "[QuotePollingService] Due mint queues discovered",
        meta: {
          mintCount: 1,
          excludedMintCount: 0,
          activeMintLanes: 0,
          residentQuotes: 0,
        },
      },
      {
        message: "[QuotePollingService] Claimed quotes for polling",
        meta: {
          mintUrl: "https://mint.example.com",
          quoteCount: 2,
          claimLimit: 100,
          mode: "batch",
          advertisedBatchSize: 100,
          residentQuotes: 2,
        },
      },
      {
        message: "[QuotePollingService] Polling round completed",
        meta: {
          mintCount: 1,
          claimedQuotes: 2,
          durationMs: 0,
          aborted: false,
        },
      },
      {
        message: "[QuotePollingService] Polling stopped",
        meta: undefined,
      },
    ]);
  });

  test("uses an advertised 1,000 quote capacity for one atomic claim and request", async () => {
    const client = new FakeClient();
    const batchingSupport = new FakeBatchingSupport();
    batchingSupport.defaultResult = { support: true, limit: 1_000 };
    const { service, store } = createService({
      quotes: quotes(1_000),
      client,
      batchingSupport,
    });

    await service.start();

    expect(store.claimCalls[0]?.limit).toBe(1_000);
    expect(client.batchCalls).toHaveLength(1);
    expect(client.batchCalls[0]?.batchSize).toBe(1_000);
    expect(client.batchCalls[0]?.quoteIds).toHaveLength(1_000);
  });

  test("bounds resident work globally while fanning out independent mint lanes", async () => {
    let activeQuotes = 0;
    let maxActiveQuotes = 0;
    let releaseRequests: (() => void) | undefined;
    const requestGate = new Promise<void>((resolve) => {
      releaseRequests = resolve;
    });
    const client = new FakeClient();
    client.batchResult = async (_mintUrl, quoteIds) => {
      activeQuotes += quoteIds.length;
      maxActiveQuotes = Math.max(maxActiveQuotes, activeQuotes);
      await requestGate;
      activeQuotes -= quoteIds.length;
      return foundBatch(quoteIds);
    };
    const batchingSupport = new FakeBatchingSupport();
    batchingSupport.defaultResult = { support: true, limit: 3_000 };
    const { service } = createService({
      quotes: [
        ...quotes(3_000, "https://mint-a.example", 1),
        ...quotes(3_000, "https://mint-b.example", 10_001),
        ...quotes(3_000, "https://mint-c.example", 20_001),
      ],
      client,
      batchingSupport,
    });

    const started = service.start();
    await yieldToPromises();

    expect(
      client.batchCalls.reduce((sum, call) => sum + call.quoteIds.length, 0),
    ).toBe(DEFAULT_MAX_RESIDENT_QUOTES);
    releaseRequests?.();
    await started;

    expect(maxActiveQuotes).toBe(DEFAULT_MAX_RESIDENT_QUOTES);
    expect(new Set(client.batchCalls.map(({ mintUrl }) => mintUrl))).toEqual(
      new Set([
        "https://mint-a.example",
        "https://mint-b.example",
        "https://mint-c.example",
      ]),
    );
  });

  test("reserves capacity for a responsive lane beside a 5,000-quote slow lane", async () => {
    let resolveSlow: ((result: BatchQuoteCheckResult) => void) | undefined;
    const slowResult = new Promise<BatchQuoteCheckResult>((resolve) => {
      resolveSlow = resolve;
    });
    const client = new FakeClient();
    let slowCalls = 0;
    client.batchResult = (mintUrl, quoteIds) => {
      if (!mintUrl.includes("slow")) return foundBatch(quoteIds);
      slowCalls += 1;
      return slowCalls === 1 ? slowResult : foundBatch(quoteIds);
    };
    const batchingSupport = new FakeBatchingSupport();
    batchingSupport.results.set("https://slow.example", {
      support: true,
      limit: 5_000,
    });
    batchingSupport.results.set("https://fast.example", {
      support: true,
      limit: 100,
    });
    const { service, handler } = createService({
      quotes: [
        ...quotes(5_000, "https://slow.example", 1),
        quote(10_001, "https://fast.example"),
      ],
      client,
      batchingSupport,
    });

    const started = service.start();
    await yieldToPromises();

    expect(
      handler.observations.map((observation) => observation.mintQuoteId),
    ).toEqual([10_001]);
    resolveSlow?.(
      foundBatch(
        client.batchCalls.find(({ mintUrl }) => mintUrl.includes("slow"))
          ?.quoteIds ?? [],
      ),
    );
    await started;
  });

  test("rotates mint queues before returning to a large backlog", async () => {
    const client = new FakeClient();
    const batchingSupport = new FakeBatchingSupport();
    batchingSupport.defaultResult = { support: true, limit: 10 };
    const { service, store } = createService({
      quotes: [
        ...quotes(20, "https://mint-a.example", 1),
        ...quotes(20, "https://mint-b.example", 101),
      ],
      client,
      batchingSupport,
      maxResidentQuotes: 10,
    });

    await service.start();

    expect(client.batchCalls.map(({ mintUrl }) => mintUrl)).toEqual([
      "https://mint-a.example",
      "https://mint-b.example",
      "https://mint-a.example",
      "https://mint-b.example",
      "https://mint-a.example",
      "https://mint-b.example",
      "https://mint-a.example",
      "https://mint-b.example",
    ]);
  });

  test("claims and individually polls only ten quotes for an unsupported mint turn", async () => {
    const batchingSupport = new FakeBatchingSupport();
    batchingSupport.defaultResult = { support: false };
    const client = new FakeClient();
    const { service, store } = createService({
      quotes: quotes(10),
      client,
      batchingSupport,
    });

    await service.start();

    expect(store.claimCalls[0]?.limit).toBe(10);
    expect(store.claimCalls.every(({ limit }) => limit <= 10)).toBe(true);
    expect(client.batchCalls).toEqual([]);
    expect(client.individualCalls.map(({ quoteId }) => quoteId)).toEqual(
      quotes(10).map(({ quoteId }) => quoteId),
    );
  });

  test("does not claim a mint queue when capability lookup fails", async () => {
    const batchingSupport = new FakeBatchingSupport();
    batchingSupport.results.set(
      "https://mint.example.com",
      new Error("mint info unavailable"),
    );
    const { service, store, client } = createService({
      quotes: [quote(1)],
      batchingSupport,
    });

    await service.start();

    expect(store.claimCalls).toEqual([]);
    expect((client as FakeClient).batchCalls).toEqual([]);
  });

  test("continues discovery past a full page of unavailable capabilities", async () => {
    const batchingSupport = new FakeBatchingSupport();
    batchingSupport.results.set(
      "https://mint-a.example",
      new Error("mint info unavailable"),
    );
    batchingSupport.results.set(
      "https://mint-b.example",
      new Error("mint info unavailable"),
    );
    const client = new FakeClient();
    const { service, store } = createService({
      quotes: [
        quote(1, "https://mint-a.example"),
        quote(2, "https://mint-b.example"),
        quote(3, "https://mint-c.example"),
      ],
      batchingSupport,
      client,
      maxResidentQuotes: 2,
    });

    await service.start();

    expect(store.claimCalls[0]?.mintUrlAliases).toEqual([
      "https://mint-c.example",
    ]);
    expect(client.batchCalls[0]?.mintUrl).toBe("https://mint-c.example");
  });

  test("bounds concurrent capability lookups by the resident quote limit", async () => {
    const capabilityResolvers = new Map<
      string,
      (support: QuoteBatchingSupport) => void
    >();
    const batchingSupport: QuoteBatchingSupportProvider = {
      supportsQuoteBatching: (mintUrl) =>
        new Promise((resolve) => {
          capabilityResolvers.set(mintUrl, resolve);
        }),
    };
    const { service } = createService({
      quotes: [
        quote(1, "https://mint-a.example"),
        quote(2, "https://mint-b.example"),
        quote(3, "https://mint-c.example"),
      ],
      batchingSupport,
      maxResidentQuotes: 2,
    });

    const started = service.start();
    await yieldToPromises();

    expect([...capabilityResolvers.keys()]).toEqual([
      "https://mint-a.example",
      "https://mint-b.example",
    ]);
    capabilityResolvers.get("https://mint-a.example")?.({
      support: true,
      limit: 1,
    });
    await yieldToPromises();
    expect([...capabilityResolvers.keys()]).toContain("https://mint-c.example");

    capabilityResolvers.get("https://mint-b.example")?.({
      support: true,
      limit: 1,
    });
    capabilityResolvers.get("https://mint-c.example")?.({
      support: true,
      limit: 1,
    });
    await started;
  });

  test("keeps capacity available for a lane with a delayed capability result", async () => {
    let resolveFastCapability:
      | ((support: QuoteBatchingSupport) => void)
      | undefined;
    const fastCapability = new Promise<QuoteBatchingSupport>((resolve) => {
      resolveFastCapability = resolve;
    });
    const batchingSupport: QuoteBatchingSupportProvider = {
      supportsQuoteBatching: (mintUrl) =>
        mintUrl.includes("fast")
          ? fastCapability
          : Promise.resolve({ support: true, limit: 5_000 }),
    };
    let resolveSlow: ((result: BatchQuoteCheckResult) => void) | undefined;
    const slowResult = new Promise<BatchQuoteCheckResult>((resolve) => {
      resolveSlow = resolve;
    });
    const client = new FakeClient();
    let slowCalls = 0;
    client.batchResult = (mintUrl, quoteIds) => {
      if (!mintUrl.includes("slow")) return foundBatch(quoteIds);
      slowCalls += 1;
      return slowCalls === 1 ? slowResult : foundBatch(quoteIds);
    };
    const { service, handler } = createService({
      quotes: [
        ...quotes(5_000, "https://slow.example", 1),
        quote(10_001, "https://fast.example"),
      ],
      client,
      batchingSupport,
    });

    const started = service.start();
    await yieldToPromises();
    resolveFastCapability?.({ support: true, limit: 100 });
    await yieldToPromises();

    expect(
      handler.observations.map((observation) => observation.mintQuoteId),
    ).toContain(10_001);
    const firstSlowCall = client.batchCalls.find(({ mintUrl }) =>
      mintUrl.includes("slow"),
    );
    expect(firstSlowCall?.quoteIds.length).toBeLessThan(5_000);

    resolveSlow?.(foundBatch(firstSlowCall?.quoteIds ?? []));
    await started;
  });

  test("does not cap an advertised 1,000 quote batch for pending lanes", async () => {
    let resolvePendingCapabilities:
      | ((support: QuoteBatchingSupport) => void)
      | undefined;
    const pendingCapabilities = new Promise<QuoteBatchingSupport>((resolve) => {
      resolvePendingCapabilities = resolve;
    });
    const batchingSupport: QuoteBatchingSupportProvider = {
      supportsQuoteBatching: (mintUrl) =>
        mintUrl.includes("mint-a")
          ? Promise.resolve({ support: true, limit: 1_000 })
          : pendingCapabilities,
    };
    const client = new FakeClient();
    const otherMints = Array.from({ length: 9 }, (_, index) =>
      quote(2_000 + index, `https://mint-${index + 1}.example`),
    );
    const { service } = createService({
      quotes: [...quotes(1_000, "https://mint-a.example"), ...otherMints],
      client,
      batchingSupport,
    });

    const started = service.start();
    await yieldToPromises();

    const advertisedBatch = client.batchCalls.find(({ mintUrl }) =>
      mintUrl.includes("mint-a"),
    );
    expect(advertisedBatch?.quoteIds).toHaveLength(1_000);

    resolvePendingCapabilities?.({ support: true, limit: 1 });
    await started;
  });

  test("falls back to the ten oldest claimed quotes after an invalid batch response", async () => {
    const client = new FakeClient();
    client.batchResult = async () => ({
      kind: "invalid_response",
      cause: new Error("bad batch response"),
    });
    const { service, store, handler } = createService({
      quotes: quotes(100),
      client,
    });

    await service.start();

    expect(store.claimCalls[0]?.limit).toBe(100);
    expect(client.individualCalls.map(({ quoteId }) => quoteId)).toEqual(
      quotes(10).map(({ quoteId }) => quoteId),
    );
    expect(handler.observations).toHaveLength(10);
  });

  test("does not individually retry an unavailable batch", async () => {
    const client = new FakeClient();
    client.batchResult = async () => ({
      kind: "mint_unavailable",
      cause: new Error("HTTP 503"),
    });
    const { service } = createService({ quotes: quotes(100), client });

    await service.start();

    expect(client.batchCalls).toHaveLength(1);
    expect(client.individualCalls).toEqual([]);
  });

  test("forwards every successful batch result with its request timestamp", async () => {
    const requestStartedAt = new Date("2026-08-10T12:00:05.000Z");
    const client = new FakeClient();
    client.batchResult = async (_mintUrl, quoteIds) => ({
      kind: "found",
      checks: quoteIds.map((quoteId) => ({
        payload: payload(quoteId, "UNPAID"),
        requestStartedAt,
      })),
    });
    const { service, handler } = createService({
      quotes: [
        quote(1, "HTTPS://MINT.EXAMPLE.COM/"),
        quote(2, "https://mint.example.com"),
      ],
      client,
    });

    await service.start();

    expect(client.batchCalls).toHaveLength(1);
    expect(handler.observations).toEqual([
      {
        source: "polling",
        mintQuoteId: 1,
        requestStartedAt,
        result: { kind: "found", payload: payload("quote-1", "UNPAID") },
      },
      {
        source: "polling",
        mintQuoteId: 2,
        requestStartedAt,
        result: { kind: "found", payload: payload("quote-2", "UNPAID") },
      },
    ]);
  });

  test("drains an existing backlog before scheduling an idle wait", async () => {
    const batchingSupport = new FakeBatchingSupport();
    batchingSupport.defaultResult = { support: true, limit: 1_000 };
    const { service, store, clock, client } = createService({
      quotes: quotes(1_500),
      batchingSupport,
    });

    await service.start();

    expect(store.claimCalls.every(({ limit }) => limit <= 1_000)).toBe(true);
    expect(
      (client as FakeClient).batchCalls.map(({ quoteIds }) => quoteIds.length),
    ).toEqual([1_000, 500]);
    expect(store.listCalls).toHaveLength(2);
    expect(clock.scheduled).toHaveLength(1);
    expect(clock.scheduled[0]?.delayMs).toBe(20_000);
  });

  test("checks an empty queue once before scheduling an idle wait", async () => {
    const { service, store, clock } = createService({ quotes: [] });

    await service.start();

    expect(store.listCalls).toEqual([
      {
        dueBefore: new Date(now.getTime() - 20_000),
        limit: DEFAULT_MAX_RESIDENT_QUOTES,
        excludedMintUrls: [],
      },
    ]);
    expect(store.claimCalls).toEqual([]);
    expect(clock.scheduled).toHaveLength(1);
  });

  test("lets a responsive mint finish while another mint is slow", async () => {
    let resolveSlow: ((result: BatchQuoteCheckResult) => void) | undefined;
    const slowResult = new Promise<BatchQuoteCheckResult>((resolve) => {
      resolveSlow = resolve;
    });
    const client = new FakeClient();
    client.batchResult = (mintUrl, quoteIds) =>
      mintUrl.includes("slow") ? slowResult : foundBatch(quoteIds);
    const { service, handler } = createService({
      quotes: [
        quote(1, "https://slow.example"),
        ...quotes(250, "https://fast.example", 2),
      ],
      client,
    });

    const started = service.start();
    await yieldToPromises();

    expect(handler.observations).toHaveLength(250);
    expect(
      handler.observations.some((observation) => observation.mintQuoteId === 1),
    ).toBe(false);
    resolveSlow?.({ kind: "mint_unavailable", cause: new Error("offline") });
    await started;
  });

  test("rechecks with a fresh cutoff before scheduling an idle wait", async () => {
    const store = new FakeStore([
      quote(1, "https://mint-a.example"),
      quote(2, "https://mint-b.example"),
    ]);
    const baseListDueMintQueues = store.listDueMintQueues.bind(store);
    store.listDueMintQueues = async (input) =>
      (await baseListDueMintQueues(input)).filter(
        ({ mintUrl }) =>
          mintUrl !== "https://mint-b.example" || input.dueBefore >= now,
      );
    const clock = new FakeClock();
    let resolveSlow: ((result: BatchQuoteCheckResult) => void) | undefined;
    const slowResult = new Promise<BatchQuoteCheckResult>((resolve) => {
      resolveSlow = resolve;
    });
    const client = new FakeClient();
    client.batchResult = (mintUrl, quoteIds) =>
      mintUrl.includes("mint-a") ? slowResult : foundBatch(quoteIds);
    const { service, handler } = createService({ store, clock, client });

    const started = service.start();
    await yieldToPromises();
    clock.current = new Date(now.getTime() + 20_001);
    const firstCall = client.batchCalls.find(({ mintUrl }) =>
      mintUrl.includes("mint-a"),
    );
    resolveSlow?.(foundBatch(firstCall?.quoteIds ?? []));
    await started;

    expect(
      handler.observations.map((observation) => observation.mintQuoteId),
    ).toEqual([1, 2]);
    expect(clock.scheduled).toHaveLength(1);
  });

  test("waits for launched lanes when stop interrupts discovery", async () => {
    const store = new FakeStore([quote(1)]);
    const baseListDueMintQueues = store.listDueMintQueues.bind(store);
    let listCalls = 0;
    let releaseDiscovery: (() => void) | undefined;
    const discoveryGate = new Promise<void>((resolve) => {
      releaseDiscovery = resolve;
    });
    store.listDueMintQueues = async (input) => {
      listCalls += 1;
      if (listCalls === 2) await discoveryGate;
      return baseListDueMintQueues(input);
    };
    let releaseRequest: ((result: BatchQuoteCheckResult) => void) | undefined;
    const client = new FakeClient();
    client.batchResult = async () =>
      new Promise((resolve) => {
        releaseRequest = resolve;
      });
    const { service } = createService({ store, client });

    const started = service.start();
    await yieldToPromises();
    let stopSettled = false;
    const stopped = service.stop().then(() => {
      stopSettled = true;
    });
    releaseDiscovery?.();
    await yieldToPromises();

    expect(stopSettled).toBe(false);
    releaseRequest?.({ kind: "mint_unavailable", cause: new Error("stopped") });
    await stopped;
    await started;
  });

  test("does not overlap scheduler turns and aborts active work on stop", async () => {
    const store = new FakeStore([quote(1)]);
    const clock = new FakeClock();
    const client = new FakeClient();
    let activeSignal: AbortSignal | undefined;
    client.batchResult = async (_mintUrl, quoteIds, signal) => {
      activeSignal = signal;
      return new Promise((resolve) => {
        signal?.addEventListener(
          "abort",
          () => resolve({ kind: "mint_unavailable", cause: signal.reason }),
          { once: true },
        );
      });
    };
    const { service } = createService({ store, clock, client });

    const firstStart = service.start();
    await yieldToPromises();
    const stopped = service.stop();

    expect(activeSignal?.aborted).toBe(true);
    await stopped;
    await firstStart;
    expect(clock.scheduled).toHaveLength(0);
    expect(store.claimCalls).toHaveLength(1);
  });

  test("persists every failed batch claim without writing legacy retry state", async () => {
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
    client.batchResult = async () => ({
      kind: "mint_unavailable",
      cause: new Error("offline"),
    });
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
        state: string;
      }>("SELECT id, last_polled_at, state FROM mint_quotes ORDER BY id");
      expect(rows.rows).toEqual([
        {
          id: active.id,
          last_polled_at: now.toISOString(),
          state: "UNPAID",
        },
        {
          id: expired.id,
          last_polled_at: now.toISOString(),
          state: "UNPAID",
        },
      ]);
      expect(
        await repository.takeDueForMintPolling({
          mintUrlAliases: ["https://mint.example.com"],
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

  test("advances every invalid batch claim but transitions only ten fallback observations", async () => {
    const adapter = new SqliteAdapter(":memory:");
    await runMigrations(adapter);
    const repository = new SqliteMintQuoteRepository(adapter);
    const created: MintQuote[] = [];
    for (let index = 1; index <= 12; index += 1) {
      created.push(
        await repository.create({
          mintUrl: "https://mint.example.com",
          paymentRequest: `lnbc-${index}`,
          unit: "sat",
          quoteId: `quote-${index}`,
          expiresAt: new Date(now.getTime() + 60_000),
          amount: 1,
          pubkey: "pubkey",
          locked: false,
        }),
      );
    }
    const stateChanges: number[] = [];
    const handler = new DefaultQuoteObservationHandler({
      store: repository,
      events: {
        emit: (_event, change) => stateChanges.push(change.quote.id),
      },
      now: () => now,
    });
    const client = new FakeClient();
    client.batchResult = async () => ({
      kind: "invalid_response",
      cause: new Error("bad batch response"),
    });
    const service = new DefaultQuotePollingService({
      store: repository,
      client,
      batchingSupport: new FakeBatchingSupport(),
      handler,
      clock: new FakeClock(),
    });

    try {
      await service.start();

      const rows = await adapter.query<{
        id: number;
        state: string;
        last_polled_at: string | null;
      }>("SELECT id, state, last_polled_at FROM mint_quotes ORDER BY id");
      expect(rows.rows.map(({ last_polled_at }) => last_polled_at)).toEqual(
        Array.from({ length: 12 }, () => now.toISOString()),
      );
      expect(rows.rows.map(({ state }) => state)).toEqual([
        ...Array.from({ length: 10 }, () => "EXPIRED"),
        "UNPAID",
        "UNPAID",
      ]);
      expect(stateChanges).toEqual(created.slice(0, 10).map(({ id }) => id));
    } finally {
      await service.stop();
      await adapter.close();
    }
  });
});
