import { describe, expect, test } from "bun:test";
import type {
  DatabaseAdapter,
  QueryResult,
} from "./database/adapter";
import { SqliteAdapter } from "./database/sqliteAdapter";
import { runMigrations } from "./migrations";

class V2PostgresAdapter implements DatabaseAdapter {
  readonly type = "postgres" as const;
  readonly queries: string[] = [];

  async query<T = Record<string, unknown>>(sql: string): Promise<QueryResult<T>> {
    this.queries.push(sql);

    if (sql.includes("information_schema.tables")) {
      return {
        rows: [{ has_v2_migrations: true }] as T[],
        rowCount: 1,
      };
    }

    throw new Error(`Unexpected query against v2 database: ${sql}`);
  }

  async close(): Promise<void> {}
}

class InitializedV3PostgresAdapter implements DatabaseAdapter {
  readonly type = "postgres" as const;
  readonly schemaStatements: string[] = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    if (sql.includes("information_schema.tables")) {
      return {
        rows: [{ has_v2_migrations: false }] as T[],
        rowCount: 1,
      };
    }

    if (sql.includes("CREATE TABLE IF NOT EXISTS _migrations")) {
      return { rows: [], rowCount: 0 };
    }

    if (sql.includes("SELECT id FROM _migrations")) {
      return {
        rows: [{ id: "001_v3_baseline" }] as T[],
        rowCount: 1,
      };
    }

    if (sql.includes("INSERT INTO _migrations")) {
      throw new Error(`Tried to reapply an initialized baseline: ${params?.[0]}`);
    }

    this.schemaStatements.push(sql);
    return { rows: [], rowCount: 0 };
  }

  async close(): Promise<void> {}
}

describe("runMigrations", () => {
  test("refuses a v2 PostgreSQL database based only on its migration marker", async () => {
    const adapter = new V2PostgresAdapter();

    let rejection: unknown;
    try {
      await runMigrations(adapter);
    } catch (error) {
      rejection = error;
    }

    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toContain("migrate:v2-postgres");
    expect((rejection as Error).message).toContain(
      '"Migrating a v2 PostgreSQL database" runbook in README.md',
    );
    expect(adapter.queries).toHaveLength(1);
    expect(adapter.queries[0]?.trimStart()).toStartWith("SELECT");
    expect(adapter.queries[0]).not.toContain("information_schema.columns");
    expect(adapter.queries[0]).not.toContain("zap_request");
  });

  test("initializes a fresh database from one idempotent v3 baseline", async () => {
    const adapter = new SqliteAdapter(":memory:");

    try {
      await runMigrations(adapter);
      await runMigrations(adapter);

      const applied = await adapter.query<{ id: string }>(
        "SELECT id FROM _migrations ORDER BY id",
      );
      const tables = await adapter.query<{ name: string }>(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name IN ('_migrations', 'l_users', 'mint_quotes', 'mints', 'proofs')
        ORDER BY name
      `);
      const mintQuoteColumns = await adapter.query<{ name: string }>(
        "PRAGMA table_info(mint_quotes)",
      );

      expect(applied.rows).toEqual([{ id: "001_v3_baseline" }]);
      expect(tables.rows).toEqual([
        { name: "_migrations" },
        { name: "l_users" },
        { name: "mint_quotes" },
        { name: "mints" },
        { name: "proofs" },
      ]);
      expect(mintQuoteColumns.rows.map((column) => column.name)).toContain(
        "serialized_zap_request",
      );
      expect(mintQuoteColumns.rows.map((column) => column.name)).not.toContain(
        "serialzed_zap_request",
      );
    } finally {
      await adapter.close();
    }
  });

  test("does not reapply the baseline to an initialized v3 PostgreSQL database", async () => {
    const adapter = new InitializedV3PostgresAdapter();

    await runMigrations(adapter);

    expect(adapter.schemaStatements).toEqual([]);
  });
});
