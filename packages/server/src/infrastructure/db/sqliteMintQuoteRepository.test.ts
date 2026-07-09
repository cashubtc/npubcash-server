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
  test("returns expired unpaid quotes stored as ISO timestamps", async () => {
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

    const expiredQuotes = await repository.getExpiredUnpaid();

    expect(expiredQuotes.map((quote) => quote.id)).toEqual([expired.id]);
  });
});
