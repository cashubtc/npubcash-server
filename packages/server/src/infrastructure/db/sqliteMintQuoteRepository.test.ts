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

  test("discovers distinct normalized due mint queues in oldest-first order", async () => {
    const dueBefore = new Date("2026-08-10T11:30:00.000Z");
    const expiresAt = new Date("2026-08-10T10:00:00.000Z");
    const createQuote = (mintUrl: string, quoteId: string) =>
      repository.create({
        mintUrl,
        paymentRequest: `lnbc-${quoteId}`,
        unit: "sat",
        quoteId,
        expiresAt,
        amount: 1,
        pubkey: "pubkey",
        locked: false,
      });

    const neverPolled = await createQuote(
      "HTTPS://MINT-A.EXAMPLE.COM/",
      "never-polled",
    );
    const sameSpellingPolled = await createQuote(
      "HTTPS://MINT-A.EXAMPLE.COM/",
      "same-spelling-polled",
    );
    const alias = await createQuote("https://mint-a.example.com", "alias");
    const oldestOtherMint = await createQuote(
      "https://mint-b.example.com",
      "oldest-other",
    );
    const recent = await createQuote("https://mint-c.example.com", "recent");
    const paid = await createQuote("https://mint-d.example.com", "paid");
    await adapter.query(
      "UPDATE mint_quotes SET last_polled_at = ? WHERE id = ?",
      ["2026-08-10T10:00:00.000Z", alias.id],
    );
    await adapter.query(
      "UPDATE mint_quotes SET last_polled_at = ? WHERE id = ?",
      ["2026-08-10T09:00:00.000Z", sameSpellingPolled.id],
    );
    await adapter.query(
      "UPDATE mint_quotes SET last_polled_at = ? WHERE id = ?",
      ["2026-08-10T11:00:00.000Z", oldestOtherMint.id],
    );
    await adapter.query(
      "UPDATE mint_quotes SET last_polled_at = ? WHERE id = ?",
      ["2026-08-10T11:59:59.000Z", recent.id],
    );
    await repository.transitionState({
      id: paid.id,
      from: ["UNPAID"],
      to: "PAID",
      paidAt: dueBefore,
    });

    expect(
      await repository.listDueMintQueues({
        dueBefore,
        limit: 10,
        excludedMintUrls: [],
      }),
    ).toEqual([
      {
        mintUrl: "https://mint-a.example.com",
        mintUrlAliases: [
          "HTTPS://MINT-A.EXAMPLE.COM/",
          "https://mint-a.example.com",
        ],
        oldestDueAt: null,
      },
      {
        mintUrl: "https://mint-b.example.com",
        mintUrlAliases: ["https://mint-b.example.com"],
        oldestDueAt: new Date("2026-08-10T11:00:00.000Z"),
      },
    ]);
    expect(neverPolled.expiresAt.getTime()).toBeLessThan(dueBefore.getTime());
  });

  test("claims only one normalized mint lane and advances it atomically", async () => {
    const expiresAt = new Date("2026-08-10T13:00:00.000Z");
    const createQuote = (mintUrl: string, quoteId: string) =>
      repository.create({
        mintUrl,
        paymentRequest: `lnbc-${quoteId}`,
        unit: "sat",
        quoteId,
        expiresAt,
        amount: 1,
        pubkey: "pubkey",
        locked: false,
      });
    const neverPolled = await createQuote(
      "HTTPS://MINT.EXAMPLE.COM/",
      "never-polled",
    );
    const oldest = await createQuote("https://mint.example.com", "oldest");
    const third = await createQuote("https://mint.example.com", "third");
    const otherMint = await createQuote("https://other.example.com", "other");
    await adapter.query(
      "UPDATE mint_quotes SET last_polled_at = ? WHERE id IN (?, ?)",
      ["2026-08-10T10:00:00.000Z", oldest.id, third.id],
    );

    const polledAt = new Date("2026-08-10T12:00:00.000Z");
    const claimed = await repository.takeDueForMintPolling({
      mintUrlAliases: ["HTTPS://MINT.EXAMPLE.COM/", "https://mint.example.com"],
      dueBefore: new Date("2026-08-10T11:30:00.000Z"),
      polledAt,
      limit: 2,
    });

    expect(claimed.map(({ id }) => id)).toEqual([neverPolled.id, oldest.id]);
    const rows = await adapter.query<{
      id: number;
      last_polled_at: string | null;
    }>("SELECT id, last_polled_at FROM mint_quotes ORDER BY id");
    expect(rows.rows).toEqual([
      { id: neverPolled.id, last_polled_at: polledAt.toISOString() },
      { id: oldest.id, last_polled_at: polledAt.toISOString() },
      { id: third.id, last_polled_at: "2026-08-10T10:00:00.000Z" },
      { id: otherMint.id, last_polled_at: null },
    ]);
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
      await recreated.takeDueForMintPolling({
        mintUrlAliases: ["HTTPS://MINT.EXAMPLE.COM/"],
        dueBefore: new Date("2026-08-03T11:00:00.000Z"),
        polledAt: new Date("2026-08-03T12:00:00.000Z"),
        limit: 1,
      }),
    ).toEqual([quote]);
    expect(
      await recreated.takeDueForMintPolling({
        mintUrlAliases: ["HTTPS://MINT.EXAMPLE.COM/"],
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
