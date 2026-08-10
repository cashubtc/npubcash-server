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
  test("returns only unexpired unpaid quotes for WebSocket recovery", async () => {
    const at = new Date("2026-08-10T12:00:00.000Z");
    await repository.create({
      mintUrl: "https://mint.example.com",
      paymentRequest: "lnbc-expired",
      unit: "sat",
      quoteId: "expired",
      expiresAt: at,
      amount: 1,
      pubkey: "pubkey",
      locked: false,
    });
    const active = await repository.create({
      mintUrl: "https://mint.example.com",
      paymentRequest: "lnbc-active",
      unit: "sat",
      quoteId: "active",
      expiresAt: new Date(at.getTime() + 60_000),
      amount: 1,
      pubkey: "pubkey",
      locked: false,
    });
    const paid = await repository.create({
      mintUrl: "https://mint.example.com",
      paymentRequest: "lnbc-paid",
      unit: "sat",
      quoteId: "paid",
      expiresAt: new Date(at.getTime() + 60_000),
      amount: 1,
      pubkey: "pubkey",
      locked: false,
    });
    await repository.transitionState({
      id: paid.id,
      from: ["UNPAID"],
      to: "PAID",
      paidAt: at,
    });

    expect(await repository.getActiveUnpaidQuotes(at)).toEqual([active]);
  });

  test("claims due unpaid quotes oldest-first and advances their polling timestamp", async () => {
    const expiresAt = new Date("2026-08-10T13:00:00.000Z");
    const nullTimestamp = await repository.create({
      mintUrl: "https://mint.example.com",
      paymentRequest: "lnbc-null",
      unit: "sat",
      quoteId: "null-timestamp",
      expiresAt,
      amount: 1,
      pubkey: "pubkey",
      locked: false,
    });
    const oldestLowId = await repository.create({
      mintUrl: "https://mint.example.com",
      paymentRequest: "lnbc-oldest-low",
      unit: "sat",
      quoteId: "oldest-low",
      expiresAt,
      amount: 1,
      pubkey: "pubkey",
      locked: false,
    });
    const oldestHighId = await repository.create({
      mintUrl: "https://mint.example.com",
      paymentRequest: "lnbc-oldest-high",
      unit: "sat",
      quoteId: "oldest-high",
      expiresAt,
      amount: 1,
      pubkey: "pubkey",
      locked: false,
    });
    const recent = await repository.create({
      mintUrl: "https://mint.example.com",
      paymentRequest: "lnbc-recent",
      unit: "sat",
      quoteId: "recent",
      expiresAt,
      amount: 1,
      pubkey: "pubkey",
      locked: false,
    });
    const paid = await repository.create({
      mintUrl: "https://mint.example.com",
      paymentRequest: "lnbc-paid",
      unit: "sat",
      quoteId: "paid",
      expiresAt,
      amount: 1,
      pubkey: "pubkey",
      locked: false,
    });
    await adapter.query(
      "UPDATE mint_quotes SET last_polled_at = ? WHERE id IN (?, ?)",
      ["2026-08-10T11:00:00.000Z", oldestLowId.id, oldestHighId.id],
    );
    await adapter.query(
      "UPDATE mint_quotes SET last_polled_at = ? WHERE id = ?",
      ["2026-08-10T11:59:59.000Z", recent.id],
    );
    await repository.transitionState({
      id: paid.id,
      from: ["UNPAID"],
      to: "PAID",
      paidAt: new Date("2026-08-10T11:30:00.000Z"),
    });

    const claimedAt = new Date("2026-08-10T12:00:00.000Z");
    const claimed = await repository.takeDueForPolling({
      dueBefore: new Date("2026-08-10T11:30:00.000Z"),
      polledAt: claimedAt,
      limit: 3,
    });

    expect(claimed.map((quote) => quote.id)).toEqual([
      nullTimestamp.id,
      oldestLowId.id,
      oldestHighId.id,
    ]);
    const rows = await adapter.query<{
      id: number;
      last_polled_at: string | null;
    }>("SELECT id, last_polled_at FROM mint_quotes ORDER BY id");
    expect(
      rows.rows
        .filter((row) => claimed.some((quote) => quote.id === row.id))
        .map((row) => row.last_polled_at),
    ).toEqual([
      claimedAt.toISOString(),
      claimedAt.toISOString(),
      claimedAt.toISOString(),
    ]);
    expect(rows.rows.find((row) => row.id === recent.id)?.last_polled_at).toBe(
      "2026-08-10T11:59:59.000Z",
    );
    expect(
      rows.rows.find((row) => row.id === paid.id)?.last_polled_at,
    ).toBeNull();
  });

  test("persists polling order and conditional financial transitions", async () => {
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

    const recreated = new SqliteMintQuoteRepository(adapter);
    expect(
      await recreated.takeDueForPolling({
        dueBefore: new Date("2026-08-03T11:00:00.000Z"),
        polledAt: new Date("2026-08-03T12:00:00.000Z"),
        limit: 1,
      }),
    ).toEqual([quote]);
    expect(
      await recreated.takeDueForPolling({
        dueBefore: new Date("2026-08-03T11:59:59.999Z"),
        polledAt: new Date("2026-08-03T12:00:01.000Z"),
        limit: 1,
      }),
    ).toEqual([]);

    const paidAt = new Date("2026-08-03T12:02:00.000Z");
    const expired = await recreated.transitionState({
      id: quote.id,
      from: ["UNPAID"],
      to: "EXPIRED",
    });
    const paid = await recreated.transitionState({
      id: quote.id,
      from: ["UNPAID", "EXPIRED"],
      to: "PAID",
      paidAt,
    });
    const raced = await recreated.transitionState({
      id: quote.id,
      from: ["UNPAID"],
      to: "EXPIRED",
    });

    expect(expired?.state).toBe("EXPIRED");
    expect(paid?.state).toBe("PAID");
    expect(paid?.paidAt).toEqual(paidAt);
    expect(raced).toBeUndefined();
  });
});
