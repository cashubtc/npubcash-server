import { describe, expect, test } from "bun:test";
import type { DatabaseAdapter, QueryResult } from "@/database/adapter";
import { PostgresMintQuoteRepository } from "./postgresMintQuoteRepository";

class RecordingPostgresAdapter implements DatabaseAdapter {
  readonly type = "postgres" as const;
  readonly calls: Array<{ sql: string; params?: unknown[] }> = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    this.calls.push({ sql, params });
    if (sql.includes("FROM mint_quote_mint_retries")) {
      return {
        rows: [
          {
            mint_url: "https://mint.example.com",
            failure_count: 3,
            next_attempt_at: new Date("2026-08-03T12:30:00.000Z"),
            last_failure_at: new Date("2026-08-03T12:00:00.000Z"),
            last_error_category: "mint_unavailable",
          },
        ] as T[],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  }

  async close(): Promise<void> {}
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

  test("round-trips a mint circuit deadline with PostgreSQL parameters", async () => {
    const db = new RecordingPostgresAdapter();
    const repository = new PostgresMintQuoteRepository(db);
    const state = {
      mintUrl: "https://mint.example.com",
      failureCount: 3,
      nextAttemptAt: new Date("2026-08-03T12:30:00.000Z"),
      lastFailureAt: new Date("2026-08-03T12:00:00.000Z"),
      lastErrorCategory: "mint_unavailable" as const,
    };

    await repository.saveMintRetryState(state);
    const restored = await repository.getMintRetryState(state.mintUrl);

    expect(db.calls[0]?.sql).toContain("ON CONFLICT(mint_url)");
    expect(db.calls[0]?.sql).toContain("$5");
    expect(db.calls[0]?.params).toEqual([
      state.mintUrl,
      state.failureCount,
      state.nextAttemptAt,
      state.lastFailureAt,
      state.lastErrorCategory,
    ]);
    expect(restored).toEqual(state);
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
