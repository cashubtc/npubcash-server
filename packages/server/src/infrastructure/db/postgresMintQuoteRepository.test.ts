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

  test("records paid_at when transitioning an unpaid quote to issued", async () => {
    const db = new RecordingPostgresAdapter();
    const repository = new PostgresMintQuoteRepository(db);
    const paidAt = new Date("2026-08-03T12:02:00.000Z");

    await repository.transitionUnpaidQuote(42, "ISSUED", paidAt);

    expect(db.calls[0]?.sql).toContain("WHEN $1 IN ('PAID', 'ISSUED')");
    expect(db.calls[0]?.sql).toContain(
      "state = 'EXPIRED' AND $1 IN ('PAID', 'ISSUED')",
    );
    expect(db.calls[0]?.params).toEqual(["ISSUED", paidAt, 42]);
  });
});
