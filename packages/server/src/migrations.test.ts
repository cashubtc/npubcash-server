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
        rows: [
          { id: "001_v3_baseline" },
          { id: "002_mint_quote_monitoring" },
          { id: "003_recipient_blocks" },
          { id: "004_mint_quote_polling_queue" },
        ] as T[],
        rowCount: 4,
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

class BaselineOnlyPostgresAdapter implements DatabaseAdapter {
  readonly type = "postgres" as const;
  readonly schemaStatements: string[] = [];
  readonly applied: string[] = [];

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
      this.applied.push(String(params?.[0]));
      return { rows: [], rowCount: 1 };
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

  test("initializes a fresh database with the complete v3 schema", async () => {
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
          AND name IN (
            '_migrations',
            'l_users',
            'mint_quotes',
            'mints',
            'proofs',
            'mint_quote_mint_retries',
            'mint_quote_reconciliation',
            'recipient_blocks'
          )
        ORDER BY name
      `);
      const mintQuoteColumns = await adapter.query<{ name: string }>(
        "PRAGMA table_info(mint_quotes)",
      );
      const mintQuoteIndexes = await adapter.query<{ name: string }>(
        "PRAGMA index_list(mint_quotes)",
      );

      expect(applied.rows).toEqual([
        { id: "001_v3_baseline" },
        { id: "002_mint_quote_monitoring" },
        { id: "003_recipient_blocks" },
        { id: "004_mint_quote_polling_queue" },
      ]);
      expect(tables.rows).toEqual([
        { name: "_migrations" },
        { name: "l_users" },
        { name: "mint_quote_mint_retries" },
        { name: "mint_quote_reconciliation" },
        { name: "mint_quotes" },
        { name: "mints" },
        { name: "proofs" },
        { name: "recipient_blocks" },
      ]);
      expect(mintQuoteColumns.rows.map((column) => column.name)).toContain(
        "serialized_zap_request",
      );
      expect(mintQuoteColumns.rows.map((column) => column.name)).not.toContain(
        "serialzed_zap_request",
      );
      expect(mintQuoteColumns.rows.map((column) => column.name)).toContain(
        "last_polled_at",
      );
      expect(mintQuoteIndexes.rows.map((index) => index.name)).toContain(
        "idx_mint_quotes_polling_queue",
      );

      const reconciliationForeignKeys = await adapter.query<{
        table: string;
        from: string;
        to: string;
        on_delete: string;
      }>("PRAGMA foreign_key_list(mint_quote_reconciliation)");
      expect(reconciliationForeignKeys.rows).toContainEqual(
        expect.objectContaining({
          table: "mint_quotes",
          from: "mint_quote_id",
          to: "id",
          on_delete: "CASCADE",
        }),
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

  test("adds later v3 features to a baseline PostgreSQL database", async () => {
    const adapter = new BaselineOnlyPostgresAdapter();

    await runMigrations(adapter);

    expect(adapter.applied).toEqual([
      "002_mint_quote_monitoring",
      "003_recipient_blocks",
      "004_mint_quote_polling_queue",
    ]);
    expect(adapter.schemaStatements.join("\n")).toContain(
      "CREATE TABLE IF NOT EXISTS mint_quote_mint_retries",
    );
    expect(adapter.schemaStatements.join("\n")).toContain(
      "CREATE TABLE IF NOT EXISTS mint_quote_reconciliation",
    );
    expect(adapter.schemaStatements.join("\n")).toContain(
      "REFERENCES mint_quotes(id) ON DELETE CASCADE",
    );
    expect(adapter.schemaStatements.join("\n")).toContain(
      "CREATE TABLE IF NOT EXISTS recipient_blocks",
    );
    expect(adapter.schemaStatements.join("\n")).toContain(
      "pubkey ~ '^[0-9a-f]{64}$'",
    );
    expect(adapter.schemaStatements.join("\n")).toContain(
      "ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ",
    );
    expect(adapter.schemaStatements.join("\n")).toContain(
      "idx_mint_quotes_polling_queue",
    );
  });

  test("creates a recipient block table constrained to canonical public keys", async () => {
    const adapter = new SqliteAdapter(":memory:");

    try {
      await runMigrations(adapter);
      const pubkey = "ab".repeat(32);
      await adapter.query(
        "INSERT INTO recipient_blocks (pubkey, reason) VALUES (?, ?)",
        [pubkey, "abuse"],
      );

      const stored = await adapter.query<{
        pubkey: string;
        created_at: string;
        reason: string | null;
      }>("SELECT pubkey, created_at, reason FROM recipient_blocks");

      expect(stored.rows).toEqual([
        {
          pubkey,
          created_at: expect.any(String),
          reason: "abuse",
        },
      ]);
      expect(
        adapter.query("INSERT INTO recipient_blocks (pubkey) VALUES (?)", [
          "AB".repeat(32),
        ]),
      ).rejects.toThrow();
      expect(
        adapter.query("INSERT INTO recipient_blocks (pubkey) VALUES (?)", [
          "g0".repeat(32),
        ]),
      ).rejects.toThrow();
      expect(
        adapter.query("INSERT INTO recipient_blocks (pubkey) VALUES (?)", [
          "ab".repeat(31),
        ]),
      ).rejects.toThrow();
      expect(
        adapter.query("INSERT INTO recipient_blocks (pubkey) VALUES (?)", [
          null,
        ]),
      ).rejects.toThrow();
    } finally {
      await adapter.close();
    }
  });

  test("retries a partially applied SQLite polling-queue migration", async () => {
    const adapter = new SqliteAdapter(":memory:");

    try {
      await runMigrations(adapter);
      await adapter.query(
        "DELETE FROM _migrations WHERE id = ?",
        ["004_mint_quote_polling_queue"],
      );

      await expect(runMigrations(adapter)).resolves.toBeUndefined();

      const columns = await adapter.query<{ name: string }>(
        "PRAGMA table_info(mint_quotes)",
      );
      const indexes = await adapter.query<{ name: string }>(
        "PRAGMA index_list(mint_quotes)",
      );
      expect(
        columns.rows.filter((column) => column.name === "last_polled_at"),
      ).toHaveLength(1);
      expect(indexes.rows.map((index) => index.name)).toContain(
        "idx_mint_quotes_polling_queue",
      );
    } finally {
      await adapter.close();
    }
  });
});
