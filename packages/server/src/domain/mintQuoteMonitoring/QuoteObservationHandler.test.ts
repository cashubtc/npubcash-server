import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { SqliteAdapter } from "@/database/sqliteAdapter";
import type { MintQuote } from "@/domain/mintQuote/MintQuote";
import type { MintQuotePayload } from "@/domain/mintQuoteMonitor/MintQuoteClient";
import { SqliteMintQuoteRepository } from "@/infrastructure/db/sqliteMintQuoteRepository";
import { runMigrations } from "@/migrations";
import { EventEmitter, type Events } from "@/events";
import {
  DefaultQuoteObservationHandler,
  type QuoteObservationHandler,
} from "./QuoteObservationHandler";
import type { QuoteStateChange } from "./QuoteObservation";

const now = new Date("2026-08-03T12:00:00.000Z");

let db: SqliteAdapter;
let store: SqliteMintQuoteRepository;
let changes: QuoteStateChange[];
let handler: QuoteObservationHandler;

beforeEach(async () => {
  db = new SqliteAdapter(":memory:");
  await runMigrations(db);
  store = new SqliteMintQuoteRepository(db);
  changes = [];
  handler = new DefaultQuoteObservationHandler({
    store,
    events: {
      emit: (_event, change) => {
        changes.push(change);
      },
    },
    now: () => now,
  });
});

afterEach(async () => {
  await db.close();
});

async function createQuote(
  quoteId: string,
  expiresAt = new Date(now.getTime() + 60_000),
): Promise<MintQuote> {
  return store.create({
    mintUrl: "https://mint.example.com",
    paymentRequest: "lnbc1",
    unit: "sat",
    quoteId,
    expiresAt,
    amount: 21,
    pubkey: "pubkey",
    locked: false,
  });
}

function payload(
  quoteId: string,
  state: MintQuotePayload["state"],
): MintQuotePayload {
  return {
    quote: quoteId,
    request: "lnbc1",
    state,
  };
}

describe("QuoteObservationHandler", () => {
  test("emits after commit and isolates a rejecting event listener", async () => {
    const quote = await createQuote("post-commit-event");
    const events = new EventEmitter<Events>();
    events.on("mintQuote.stateChanged", async () => {
      throw new Error("listener failed");
    });

    let finishObservation!: () => void;
    const observationFinished = new Promise<void>((resolve) => {
      finishObservation = resolve;
    });
    let stateObservedByListener: MintQuote["state"] | undefined;
    events.on("mintQuote.stateChanged", async ({ quote: changedQuote }) => {
      stateObservedByListener = (
        await store.getById(changedQuote.id)
      )?.state;
      finishObservation();
    });
    const integratedHandler = new DefaultQuoteObservationHandler({
      store,
      events,
      now: () => now,
    });

    const change = await integratedHandler.handle({
      source: "websocket",
      mintQuoteId: quote.id,
      payload: payload(quote.quoteId, "PAID"),
    });
    await observationFinished;

    expect(change?.quote.state).toBe("PAID");
    expect(stateObservedByListener).toBe("PAID");
    expect((await store.getById(quote.id))?.state).toBe("PAID");
  });

  test("persists and emits one paid change for racing polling and websocket observations", async () => {
    const quote = await createQuote("raced-paid");

    const results = await Promise.all([
      handler.handle({
        source: "polling",
        mintQuoteId: quote.id,
        requestStartedAt: now,
        result: { kind: "found", payload: payload(quote.quoteId, "PAID") },
      }),
      handler.handle({
        source: "websocket",
        mintQuoteId: quote.id,
        payload: payload(quote.quoteId, "PAID"),
      }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.quote.state).toBe("PAID");
    expect(changes[0]?.quote.paidAt).toEqual(now);
    expect((await store.getById(quote.id))?.state).toBe("PAID");
  });

  test("uses only an authoritative polling observation to expire a quote", async () => {
    const quote = await createQuote(
      "expired-unpaid",
      new Date(now.getTime() - 1),
    );

    expect(
      await handler.handle({
        source: "websocket",
        mintQuoteId: quote.id,
        payload: payload(quote.quoteId, "UNPAID"),
      }),
    ).toBeUndefined();
    expect(
      await handler.handle({
        source: "polling",
        mintQuoteId: quote.id,
        requestStartedAt: new Date(quote.expiresAt.getTime() - 1),
        result: { kind: "found", payload: payload(quote.quoteId, "UNPAID") },
      }),
    ).toBeUndefined();

    const change = await handler.handle({
      source: "polling",
      mintQuoteId: quote.id,
      requestStartedAt: quote.expiresAt,
      result: { kind: "found", payload: payload(quote.quoteId, "UNPAID") },
    });

    expect(change?.quote.state).toBe("EXPIRED");
    expect(changes).toHaveLength(1);
  });

  test("treats not-found as authoritative and permits a paid correction", async () => {
    const quote = await createQuote("missing-then-paid");

    const expired = await handler.handle({
      source: "polling",
      mintQuoteId: quote.id,
      requestStartedAt: now,
      result: { kind: "not_found" },
    });
    const paid = await handler.handle({
      source: "websocket",
      mintQuoteId: quote.id,
      payload: payload(quote.quoteId, "PAID"),
    });

    expect(expired?.quote.state).toBe("EXPIRED");
    expect(paid?.quote.state).toBe("PAID");
    expect(changes.map(({ quote: changed }) => changed.state)).toEqual([
      "EXPIRED",
      "PAID",
    ]);
  });

  test("preserves paid_at when paid advances to issued", async () => {
    const quote = await createQuote("paid-issued");
    await handler.handle({
      source: "websocket",
      mintQuoteId: quote.id,
      payload: payload(quote.quoteId, "PAID"),
    });

    const later = new Date(now.getTime() + 30_000);
    const laterHandler = new DefaultQuoteObservationHandler({
      store,
      events: { emit: () => {} },
      now: () => later,
    });
    const issued = await laterHandler.handle({
      source: "polling",
      mintQuoteId: quote.id,
      requestStartedAt: later,
      result: { kind: "found", payload: payload(quote.quoteId, "ISSUED") },
    });

    expect(issued?.quote.state).toBe("ISSUED");
    expect(issued?.quote.paidAt).toEqual(now);
  });

  test("sets paid_at when an unpaid quote advances directly to issued", async () => {
    const quote = await createQuote("unpaid-issued");

    const issued = await handler.handle({
      source: "websocket",
      mintQuoteId: quote.id,
      payload: payload(quote.quoteId, "ISSUED"),
    });

    expect(issued?.quote.state).toBe("ISSUED");
    expect(issued?.quote.paidAt).toEqual(now);
  });

  test("ignores mismatched, pending, duplicate, and regressive observations", async () => {
    const quote = await createQuote("ignored");

    expect(
      await handler.handle({
        source: "websocket",
        mintQuoteId: quote.id,
        payload: payload("different", "PAID"),
      }),
    ).toBeUndefined();
    expect(
      await handler.handle({
        source: "websocket",
        mintQuoteId: quote.id,
        payload: payload(quote.quoteId, "PENDING"),
      }),
    ).toBeUndefined();

    await handler.handle({
      source: "websocket",
      mintQuoteId: quote.id,
      payload: payload(quote.quoteId, "ISSUED"),
    });
    expect(
      await handler.handle({
        source: "websocket",
        mintQuoteId: quote.id,
        payload: payload(quote.quoteId, "PAID"),
      }),
    ).toBeUndefined();
    expect(
      await handler.handle({
        source: "websocket",
        mintQuoteId: quote.id,
        payload: payload(quote.quoteId, "ISSUED"),
      }),
    ).toBeUndefined();

    expect(changes).toHaveLength(1);
    expect((await store.getById(quote.id))?.state).toBe("ISSUED");
  });
});
