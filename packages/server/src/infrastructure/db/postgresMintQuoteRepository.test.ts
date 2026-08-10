import { describe, expect, test } from "bun:test";
import type { DatabaseAdapter, QueryResult } from "@/database/adapter";
import { runMigrations } from "@/migrations";
import pg from "pg";
import { PostgresMintQuoteRepository } from "./postgresMintQuoteRepository";

class RecordingPostgresAdapter implements DatabaseAdapter {
  readonly type = "postgres" as const;
  readonly calls: Array<{ sql: string; params?: unknown[] }> = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    this.calls.push({ sql, params });
    return { rows: [], rowCount: 0 };
  }

  async close(): Promise<void> {}
}

class PostgresTestAdapter implements DatabaseAdapter {
  readonly type = "postgres" as const;

  constructor(private readonly client: pg.Client) {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const result = await this.client.query(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
    };
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}

describe("PostgresMintQuoteRepository monitoring adapter", () => {
  test("queries only active unpaid quotes for WebSocket recovery", async () => {
    const db = new RecordingPostgresAdapter();
    const repository = new PostgresMintQuoteRepository(db);
    const now = new Date("2026-08-10T12:00:00.000Z");

    await repository.getActiveUnpaidQuotes(now);

    expect(db.calls[0]?.sql).toContain(
      "state = 'UNPAID' AND expires_at > $1",
    );
    expect(db.calls[0]?.sql).toContain("ORDER BY id");
    expect(db.calls[0]?.params).toEqual([now]);
  });

  test("claims due unpaid quotes atomically in persistent polling order", async () => {
    const db = new RecordingPostgresAdapter();
    const repository = new PostgresMintQuoteRepository(db);
    const dueBefore = new Date("2026-08-10T11:59:40.000Z");
    const polledAt = new Date("2026-08-10T12:00:00.000Z");

    await repository.takeDueForPolling({ dueBefore, polledAt, limit: 100 });

    expect(db.calls[0]?.sql).toContain("state = 'UNPAID'");
    expect(db.calls[0]?.sql).toContain("last_polled_at NULLS FIRST, id");
    expect(db.calls[0]?.sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(db.calls[0]?.sql).toContain("SET last_polled_at = $3");
    expect(db.calls[0]?.sql).toContain("ORDER BY due.polling_order");
    expect(db.calls[0]?.params).toEqual([dueBefore, 100, polledAt]);
  });

  test("records paid_at when conditionally transitioning a quote to issued", async () => {
    const db = new RecordingPostgresAdapter();
    const repository = new PostgresMintQuoteRepository(db);
    const paidAt = new Date("2026-08-03T12:02:00.000Z");

    await repository.transitionState({
      id: 42,
      from: ["UNPAID", "EXPIRED", "PAID"],
      to: "ISSUED",
      paidAt,
    });

    expect(db.calls[0]?.sql).toContain(
      "WHEN $1 IN ('PAID', 'ISSUED') THEN COALESCE(paid_at, $2)",
    );
    expect(db.calls[0]?.sql).toContain("state IN ($4, $5, $6)");
    expect(db.calls[0]?.params).toEqual([
      "ISSUED",
      paidAt,
      42,
      "UNPAID",
      "EXPIRED",
      "PAID",
    ]);
  });
});

const postgresConnectionString = process.env.TEST_POSTGRES_DATABASE_URL;
const postgresTest = postgresConnectionString ? test : test.skip;

postgresTest(
  "PostgreSQL claims due unpaid quotes oldest-first without duplicate concurrent claims",
  async () => {
    const schema = `quote_polling_${crypto.randomUUID().replaceAll("-", "")}`;
    const admin = new pg.Client({ connectionString: postgresConnectionString });
    const firstClient = new pg.Client({
      connectionString: postgresConnectionString,
    });
    const secondClient = new pg.Client({
      connectionString: postgresConnectionString,
    });
    await admin.connect();
    await firstClient.connect();
    await secondClient.connect();

    try {
      await admin.query(`CREATE SCHEMA "${schema}"`);
      await firstClient.query(`SET search_path TO "${schema}"`);
      await secondClient.query(`SET search_path TO "${schema}"`);
      const firstAdapter = new PostgresTestAdapter(firstClient);
      const secondAdapter = new PostgresTestAdapter(secondClient);
      await runMigrations(firstAdapter);
      const first = new PostgresMintQuoteRepository(firstAdapter);
      const second = new PostgresMintQuoteRepository(secondAdapter);
      const expiresAt = new Date("2026-08-10T13:00:00.000Z");
      const createQuote = (quoteId: string) =>
        first.create({
          mintUrl: "https://mint.example.com",
          paymentRequest: `lnbc-${quoteId}`,
          unit: "sat",
          quoteId,
          expiresAt,
          amount: 1,
          pubkey: "pubkey",
          locked: false,
        });
      const neverPolled = await createQuote("never-polled");
      const oldestLowId = await createQuote("oldest-low");
      const oldestHighId = await createQuote("oldest-high");
      const recent = await createQuote("recent");
      const paid = await createQuote("paid");
      await firstAdapter.query(
        "UPDATE mint_quotes SET last_polled_at = $1 WHERE id IN ($2, $3)",
        [
          new Date("2026-08-10T11:00:00.000Z"),
          oldestLowId.id,
          oldestHighId.id,
        ],
      );
      await firstAdapter.query(
        "UPDATE mint_quotes SET last_polled_at = $1 WHERE id = $2",
        [new Date("2026-08-10T11:59:59.000Z"), recent.id],
      );
      await first.transitionState({
        id: paid.id,
        from: ["UNPAID"],
        to: "PAID",
        paidAt: new Date("2026-08-10T11:30:00.000Z"),
      });

      const claimedAt = new Date("2026-08-10T12:00:00.000Z");
      const claimed = await first.takeDueForPolling({
        dueBefore: new Date("2026-08-10T11:30:00.000Z"),
        polledAt: claimedAt,
        limit: 3,
      });
      expect(claimed.map((quote) => quote.id)).toEqual([
        neverPolled.id,
        oldestLowId.id,
        oldestHighId.id,
      ]);
      const rows = await firstAdapter.query<{
        id: string;
        last_polled_at: Date | null;
      }>("SELECT id, last_polled_at FROM mint_quotes ORDER BY id");
      expect(
        rows.rows
          .filter((row) => claimed.some((quote) => quote.id === Number(row.id)))
          .map((row) => row.last_polled_at),
      ).toEqual([claimedAt, claimedAt, claimedAt]);
      expect(
        rows.rows.find((row) => Number(row.id) === recent.id)?.last_polled_at,
      ).toEqual(new Date("2026-08-10T11:59:59.000Z"));
      expect(
        rows.rows.find((row) => Number(row.id) === paid.id)?.last_polled_at,
      ).toBeNull();

      const concurrentQuotes = await Promise.all([
        createQuote("concurrent-1"),
        createQuote("concurrent-2"),
        createQuote("concurrent-3"),
        createQuote("concurrent-4"),
      ]);
      const claims = await Promise.all([
        first.takeDueForPolling({
          dueBefore: new Date("2026-08-10T11:30:00.000Z"),
          polledAt: new Date("2026-08-10T12:01:00.000Z"),
          limit: 2,
        }),
        second.takeDueForPolling({
          dueBefore: new Date("2026-08-10T11:30:00.000Z"),
          polledAt: new Date("2026-08-10T12:01:00.000Z"),
          limit: 2,
        }),
      ]);
      const concurrentlyClaimedIds = claims
        .flat()
        .map((quote) => quote.id)
        .sort((a, b) => a - b);
      expect(concurrentlyClaimedIds).toEqual(
        concurrentQuotes.map((quote) => quote.id).sort((a, b) => a - b),
      );
      expect(new Set(concurrentlyClaimedIds).size).toBe(4);
    } finally {
      await firstClient.end();
      await secondClient.end();
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  },
);
