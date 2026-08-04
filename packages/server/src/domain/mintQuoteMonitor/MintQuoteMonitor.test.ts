import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { SqliteAdapter } from "@/database/sqliteAdapter";
import { MintQuote } from "@/domain/mintQuote/MintQuote";
import { SqliteMintQuoteRepository } from "@/infrastructure/db/sqliteMintQuoteRepository";
import { runMigrations } from "@/migrations";
import type {
  MintQuoteClient,
  MintQuotePayload,
  QuoteCheckResult,
} from "./MintQuoteClient";
import {
  DefaultMintQuoteMonitor,
  type ActiveQuoteTransport,
  type MonitorClock,
} from "./MintQuoteMonitor";

class FakeClock implements MonitorClock {
  private nextId = 1;
  private readonly tasks = new Map<
    number,
    { at: number; callback: () => void | Promise<void> }
  >();

  constructor(private currentMs: number) {}

  now(): Date {
    return new Date(this.currentMs);
  }

  schedule(
    callback: () => void | Promise<void>,
    delayMs: number,
  ): number {
    const id = this.nextId++;
    this.tasks.set(id, {
      at: this.currentMs + Math.max(0, delayMs),
      callback,
    });
    return id;
  }

  cancel(handle: unknown): void {
    this.tasks.delete(handle as number);
  }

  async advanceBy(ms: number): Promise<void> {
    const target = this.currentMs + ms;
    while (true) {
      const due = [...this.tasks.entries()]
        .filter(([, task]) => task.at <= target)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      this.tasks.delete(due[0]);
      this.currentMs = due[1].at;
      await due[1].callback();
    }
    this.currentMs = target;
  }

  pendingCount(): number {
    return this.tasks.size;
  }
}

class FakeMintClient implements MintQuoteClient {
  readonly calls: Array<{ mintUrl: string; quoteId: string }> = [];
  readonly signals: AbortSignal[] = [];

  constructor(
    private readonly respond: (
      mintUrl: string,
      quoteId: string,
      signal?: AbortSignal,
    ) => QuoteCheckResult | Promise<QuoteCheckResult>,
  ) {}

  async checkQuote(
    mintUrl: string,
    quoteId: string,
    signal?: AbortSignal,
  ): Promise<QuoteCheckResult> {
    this.calls.push({ mintUrl, quoteId });
    if (signal) this.signals.push(signal);
    return this.respond(mintUrl, quoteId, signal);
  }
}

class FakeActiveQuoteTransport implements ActiveQuoteTransport {
  readonly callbacks = new Map<
    string,
    (payload: MintQuotePayload) => void | Promise<void>
  >();
  closeCount = 0;

  watch(
    mintUrl: string,
    quoteId: string,
    onPayload: (payload: MintQuotePayload) => void | Promise<void>,
  ): () => void {
    const key = `${mintUrl}::${quoteId}`;
    this.callbacks.set(key, onPayload);
    return () => {
      this.callbacks.delete(key);
      this.closeCount += 1;
    };
  }

  stop(): void {
    this.callbacks.clear();
  }

  async emit(
    mintUrl: string,
    quoteId: string,
    payload: MintQuotePayload,
  ): Promise<void> {
    await this.callbacks.get(`${mintUrl}::${quoteId}`)?.(payload);
  }
}

const paidPayload = (quoteId: string): MintQuotePayload => ({
  quote: quoteId,
  request: "lnbc1",
  state: "PAID",
  expiry: 1_786_000_000,
});

let db: SqliteAdapter;
let store: SqliteMintQuoteRepository;

beforeEach(async () => {
  db = new SqliteAdapter(":memory:");
  await runMigrations(db);
  store = new SqliteMintQuoteRepository(db);
});

afterEach(async () => {
  await db.close();
});

async function createQuote(
  quoteId: string,
  mintUrl: string,
  expiresAt: Date,
): Promise<MintQuote> {
  return store.create({
    mintUrl,
    paymentRequest: "lnbc1",
    unit: "sat",
    quoteId,
    expiresAt,
    amount: 21,
    pubkey: "pubkey",
    locked: false,
  });
}

describe("MintQuoteMonitor", () => {
  test("restores an expired quote and emits the persisted paid model", async () => {
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    const quote = await createQuote(
      "quote-paid",
      "HTTPS://MINT.EXAMPLE.COM/",
      new Date(now - 1_000),
    );
    const clock = new FakeClock(now);
    const client = new FakeMintClient((_mintUrl, quoteId) => ({
      kind: "found",
      payload: paidPayload(quoteId),
    }));
    const activeTransport = new FakeActiveQuoteTransport();
    const paid: MintQuote[] = [];
    const monitor = new DefaultMintQuoteMonitor({
      store,
      client,
      activeTransport,
      clock,
      random: () => 0.5,
      onPaid: (model) => {
        paid.push(model);
      },
    });

    await monitor.start();
    await clock.advanceBy(0);

    expect(client.calls).toEqual([
      { mintUrl: "https://mint.example.com", quoteId: quote.quoteId },
    ]);
    expect(paid).toHaveLength(1);
    expect(paid[0]?.state).toBe("PAID");
    expect(paid[0]?.paidAt).toEqual(new Date(now));
    expect(activeTransport.callbacks.size).toBe(0);
  });

  test("expires only after an authoritative unpaid reconciliation", async () => {
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    await createQuote(
      "quote-unpaid",
      "https://mint.example.com",
      new Date(now - 1_000),
    );
    const clock = new FakeClock(now);
    const monitor = new DefaultMintQuoteMonitor({
      store,
      client: new FakeMintClient((_mintUrl, quoteId) => ({
        kind: "found",
        payload: {
          ...paidPayload(quoteId),
          state: "UNPAID",
          expiry: Math.floor((now - 1_000) / 1_000),
        },
      })),
      activeTransport: new FakeActiveQuoteTransport(),
      clock,
      random: () => 0.5,
    });

    await monitor.start();
    await clock.advanceBy(0);
    await monitor.stop();

    const restartClient = new FakeMintClient((_mintUrl, quoteId) => ({
      kind: "found",
      payload: paidPayload(quoteId),
    }));
    const restarted = new DefaultMintQuoteMonitor({
      store,
      client: restartClient,
      activeTransport: new FakeActiveQuoteTransport(),
      clock,
      random: () => 0.5,
    });
    await restarted.start();
    await clock.advanceBy(0);

    expect(restartClient.calls).toEqual([]);
  });

  test("crossing expiry during an outage keeps the quote recoverable", async () => {
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    await createQuote(
      "quote-outage",
      "https://mint.example.com",
      new Date(now + 1_000),
    );
    const clock = new FakeClock(now);
    let checks = 0;
    const monitor = new DefaultMintQuoteMonitor({
      store,
      client: new FakeMintClient((_mintUrl, quoteId) => {
        checks += 1;
        return checks === 1
          ? {
              kind: "found",
              payload: {
                ...paidPayload(quoteId),
                state: "UNPAID",
                expiry: Math.floor((now + 1_000) / 1_000),
              },
            }
          : { kind: "mint_unavailable", cause: new Error("offline") };
      }),
      activeTransport: new FakeActiveQuoteTransport(),
      clock,
      random: () => 0.5,
      policy: { reconciliationRetryMs: [60_000] },
    });
    await monitor.start();
    await clock.advanceBy(0);
    await clock.advanceBy(1_000);
    await monitor.stop();

    const paid: MintQuote[] = [];
    const restartClient = new FakeMintClient((_mintUrl, quoteId) => ({
      kind: "found",
      payload: paidPayload(quoteId),
    }));
    const restarted = new DefaultMintQuoteMonitor({
      store,
      client: restartClient,
      activeTransport: new FakeActiveQuoteTransport(),
      clock,
      random: () => 0.5,
      onPaid: (quote) => {
        paid.push(quote);
      },
    });
    await restarted.start();
    await clock.advanceBy(59_999);
    expect(restartClient.calls).toEqual([]);
    await clock.advanceBy(1);

    expect(restartClient.calls).toHaveLength(1);
    expect(paid).toHaveLength(1);
  });

  test("a mint outage pauses that mint, survives restart, and not other mints", async () => {
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    await createQuote("mint-a-1", "https://mint-a.example.com", new Date(now - 1));
    await createQuote("mint-a-2", "https://mint-a.example.com", new Date(now - 1));
    await createQuote("mint-b-1", "https://mint-b.example.com", new Date(now - 1));
    const clock = new FakeClock(now);
    const client = new FakeMintClient((mintUrl, quoteId) =>
      mintUrl.includes("mint-a")
        ? { kind: "mint_unavailable", cause: new Error("offline") }
        : { kind: "found", payload: paidPayload(quoteId) },
    );
    const monitor = new DefaultMintQuoteMonitor({
      store,
      client,
      activeTransport: new FakeActiveQuoteTransport(),
      clock,
      random: () => 0.5,
      policy: { reconciliationRetryMs: [60_000] },
    });
    await monitor.start();
    await clock.advanceBy(0);

    expect(client.calls.filter((call) => call.mintUrl.includes("mint-a"))).toHaveLength(1);
    expect(client.calls.filter((call) => call.mintUrl.includes("mint-b"))).toHaveLength(1);
    await monitor.stop();

    const restartClient = new FakeMintClient((_mintUrl, quoteId) => ({
      kind: "found",
      payload: paidPayload(quoteId),
    }));
    const restarted = new DefaultMintQuoteMonitor({
      store,
      client: restartClient,
      activeTransport: new FakeActiveQuoteTransport(),
      clock,
      random: () => 0.5,
    });
    await restarted.start();
    await clock.advanceBy(59_999);
    expect(restartClient.calls).toEqual([]);
    await clock.advanceBy(1);

    expect(restartClient.calls.map((call) => call.quoteId).sort()).toEqual([
      "mint-a-1",
      "mint-a-2",
    ]);
  });

  test("quote not found stays unresolved and is retried quietly", async () => {
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    await createQuote(
      "missing-quote",
      "https://mint.example.com",
      new Date(now - 1),
    );
    const clock = new FakeClock(now);
    let missing = true;
    const paid: MintQuote[] = [];
    const client = new FakeMintClient((_mintUrl, quoteId) =>
      missing
        ? { kind: "not_found" }
        : { kind: "found", payload: paidPayload(quoteId) },
    );
    const monitor = new DefaultMintQuoteMonitor({
      store,
      client,
      activeTransport: new FakeActiveQuoteTransport(),
      clock,
      random: () => 0.5,
      onPaid: (quote) => {
        paid.push(quote);
      },
    });
    await monitor.start();
    await clock.advanceBy(0);
    await clock.advanceBy(3_599_999);
    expect(client.calls).toHaveLength(1);

    missing = false;
    await clock.advanceBy(1);
    expect(client.calls).toHaveLength(2);
    expect(paid).toHaveLength(1);
  });

  test("an active quote not-found deadline survives restart", async () => {
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    await createQuote(
      "active-missing",
      "https://mint.example.com",
      new Date(now + 7_200_000),
    );
    const clock = new FakeClock(now);
    const monitor = new DefaultMintQuoteMonitor({
      store,
      client: new FakeMintClient(() => ({ kind: "not_found" })),
      activeTransport: new FakeActiveQuoteTransport(),
      clock,
      random: () => 0.5,
    });
    await monitor.start();
    await clock.advanceBy(0);
    await monitor.stop();

    const restartClient = new FakeMintClient((_mintUrl, quoteId) => ({
      kind: "found",
      payload: paidPayload(quoteId),
    }));
    const restarted = new DefaultMintQuoteMonitor({
      store,
      client: restartClient,
      activeTransport: new FakeActiveQuoteTransport(),
      clock,
      random: () => 0.5,
    });
    await restarted.start();
    await clock.advanceBy(3_599_999);
    expect(restartClient.calls).toEqual([]);
    await clock.advanceBy(1);
    expect(restartClient.calls).toHaveLength(1);
  });

  test("a websocket setup failure retains the HTTP fallback", async () => {
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    await createQuote(
      "http-fallback",
      "https://mint.example.com",
      new Date(now + 60_000),
    );
    const clock = new FakeClock(now);
    const client = new FakeMintClient((_mintUrl, quoteId) => ({
      kind: "found",
      payload: paidPayload(quoteId),
    }));
    const monitor = new DefaultMintQuoteMonitor({
      store,
      client,
      activeTransport: {
        watch: () => {
          throw new Error("websocket unavailable");
        },
        stop: () => {},
      },
      clock,
      random: () => 0.5,
    });

    await monitor.start();
    await clock.advanceBy(0);

    expect(client.calls).toHaveLength(1);
  });

  test("issued is persisted and not restored", async () => {
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    await createQuote("issued", "https://mint.example.com", new Date(now - 1));
    const clock = new FakeClock(now);
    const monitor = new DefaultMintQuoteMonitor({
      store,
      client: new FakeMintClient((_mintUrl, quoteId) => ({
        kind: "found",
        payload: { ...paidPayload(quoteId), state: "ISSUED" },
      })),
      activeTransport: new FakeActiveQuoteTransport(),
      clock,
      random: () => 0.5,
    });
    await monitor.start();
    await clock.advanceBy(0);
    await monitor.stop();

    const restartClient = new FakeMintClient((_mintUrl, quoteId) => ({
      kind: "found",
      payload: paidPayload(quoteId),
    }));
    const restarted = new DefaultMintQuoteMonitor({
      store,
      client: restartClient,
      activeTransport: new FakeActiveQuoteTransport(),
      clock,
    });
    await restarted.start();
    await clock.advanceBy(0);

    expect(restartClient.calls).toEqual([]);
  });

  test("racing websocket and HTTP paid observations emit once and clean up", async () => {
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    const quote = await createQuote(
      "raced",
      "https://mint.example.com",
      new Date(now + 60_000),
    );
    const clock = new FakeClock(now);
    let resolveHttp!: (result: QuoteCheckResult) => void;
    const httpResult = new Promise<QuoteCheckResult>((resolve) => {
      resolveHttp = resolve;
    });
    const activeTransport = new FakeActiveQuoteTransport();
    const paid: MintQuote[] = [];
    const monitor = new DefaultMintQuoteMonitor({
      store,
      client: new FakeMintClient(() => httpResult),
      activeTransport,
      clock,
      random: () => 0.5,
      onPaid: (model) => {
        paid.push(model);
      },
    });
    await monitor.start();

    const polling = clock.advanceBy(0);
    await Promise.resolve();
    await activeTransport.emit(
      "https://mint.example.com",
      quote.quoteId,
      paidPayload(quote.quoteId),
    );
    resolveHttp({ kind: "found", payload: paidPayload(quote.quoteId) });
    await polling;

    expect(paid).toHaveLength(1);
    expect(activeTransport.closeCount).toBe(1);
    expect(activeTransport.callbacks.size).toBe(0);
    expect(clock.pendingCount()).toBe(0);
  });

  test("a terminal websocket observation aborts the in-flight HTTP check", async () => {
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    const quote = await createQuote(
      "abort-http",
      "https://mint.example.com",
      new Date(now + 60_000),
    );
    const clock = new FakeClock(now);
    let resolveHttp!: (result: QuoteCheckResult) => void;
    const httpResult = new Promise<QuoteCheckResult>((resolve) => {
      resolveHttp = resolve;
    });
    const activeTransport = new FakeActiveQuoteTransport();
    const client = new FakeMintClient(() => httpResult);
    const monitor = new DefaultMintQuoteMonitor({
      store,
      client,
      activeTransport,
      clock,
      random: () => 0.5,
    });
    await monitor.start();

    const polling = clock.advanceBy(0);
    await Promise.resolve();
    await activeTransport.emit(
      "https://mint.example.com",
      quote.quoteId,
      paidPayload(quote.quoteId),
    );

    expect(client.signals[0]?.aborted).toBe(true);

    resolveHttp({ kind: "mint_unavailable", cause: new Error("aborted") });
    await polling;
  });

  test("stopping the monitor aborts the in-flight HTTP check", async () => {
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    await createQuote(
      "stop-aborts-http",
      "https://mint.example.com",
      new Date(now + 60_000),
    );
    const clock = new FakeClock(now);
    let resolveHttp!: (result: QuoteCheckResult) => void;
    const httpResult = new Promise<QuoteCheckResult>((resolve) => {
      resolveHttp = resolve;
    });
    const client = new FakeMintClient(() => httpResult);
    const monitor = new DefaultMintQuoteMonitor({
      store,
      client,
      activeTransport: new FakeActiveQuoteTransport(),
      clock,
      random: () => 0.5,
    });
    await monitor.start();

    const polling = clock.advanceBy(0);
    await Promise.resolve();
    await monitor.stop();

    expect(client.signals[0]?.aborted).toBe(true);

    resolveHttp({ kind: "mint_unavailable", cause: new Error("aborted") });
    await polling;
  });
});
