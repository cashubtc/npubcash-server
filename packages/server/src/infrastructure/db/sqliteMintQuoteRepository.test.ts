import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { SqliteAdapter } from "@/database/sqliteAdapter";
import { runMigrations } from "@/migrations";
import { SqliteMintQuoteRepository } from "./sqliteMintQuoteRepository";

let adapter: SqliteAdapter;
let repository: SqliteMintQuoteRepository;

beforeEach(async () => {
  adapter = new SqliteAdapter(":memory:");
  await runMigrations(adapter);
  repository = new SqliteMintQuoteRepository(adapter);
});

afterEach(async () => {
  await adapter.close();
});

describe("SqliteMintQuoteRepository", () => {
  test("returns expired unpaid quotes as recoverable", async () => {
    const expired = await repository.create({
      mintUrl: "https://mint.example.com",
      paymentRequest: "lnbc-expired",
      unit: "sat",
      quoteId: "expired-quote",
      expiresAt: new Date(Date.now() - 60_000),
      amount: 1,
      pubkey: "pubkey",
      locked: false,
    });
    await repository.create({
      mintUrl: "https://mint.example.com",
      paymentRequest: "lnbc-future",
      unit: "sat",
      quoteId: "future-quote",
      expiresAt: new Date(Date.now() + 60_000),
      amount: 1,
      pubkey: "pubkey",
      locked: false,
    });

    const recoverableQuotes = await repository.getRecoverableQuotes();

    expect(recoverableQuotes.map((quote) => quote.id)).toContain(expired.id);
  });

  test("persists monitoring deadlines and conditional financial transitions", async () => {
    const quote = await repository.create({
      mintUrl: "HTTPS://MINT.EXAMPLE.COM/",
      paymentRequest: "lnbc1",
      unit: "sat",
      quoteId: "quote-1",
      expiresAt: new Date("2026-08-03T12:00:00.000Z"),
      amount: 21,
      pubkey: "pubkey",
      locked: false,
    });

    await repository.saveMintRetryState({
      mintUrl: "https://mint.example.com",
      failureCount: 2,
      nextAttemptAt: new Date("2026-08-03T12:05:00.000Z"),
      lastFailureAt: new Date("2026-08-03T12:04:00.000Z"),
      lastErrorCategory: "mint_unavailable",
    });
    await repository.saveQuoteReconciliationState({
      mintQuoteId: quote.id,
      lastCheckedAt: new Date("2026-08-03T12:01:00.000Z"),
      nextCheckAt: new Date("2026-08-03T13:01:00.000Z"),
      notFoundCount: 1,
      lastResult: "not_found",
    });

    const recreated = new SqliteMintQuoteRepository(adapter);
    expect(
      await recreated.getMintRetryState("https://mint.example.com"),
    ).toEqual({
      mintUrl: "https://mint.example.com",
      failureCount: 2,
      nextAttemptAt: new Date("2026-08-03T12:05:00.000Z"),
      lastFailureAt: new Date("2026-08-03T12:04:00.000Z"),
      lastErrorCategory: "mint_unavailable",
    });
    expect(await recreated.getQuoteReconciliationState(quote.id)).toEqual({
      mintQuoteId: quote.id,
      lastCheckedAt: new Date("2026-08-03T12:01:00.000Z"),
      nextCheckAt: new Date("2026-08-03T13:01:00.000Z"),
      notFoundCount: 1,
      lastResult: "not_found",
    });

    const paidAt = new Date("2026-08-03T12:02:00.000Z");
    const expired = await recreated.transitionUnpaidQuote(
      quote.id,
      "EXPIRED",
    );
    const paid = await recreated.transitionUnpaidQuote(
      quote.id,
      "PAID",
      paidAt,
    );
    const raced = await recreated.transitionUnpaidQuote(
      quote.id,
      "EXPIRED",
    );

    expect(expired?.state).toBe("EXPIRED");
    expect(paid?.state).toBe("PAID");
    expect(paid?.paidAt).toEqual(paidAt);
    expect(raced).toBeUndefined();
    expect(await recreated.getRecoverableQuotes()).toEqual([]);
  });
});
