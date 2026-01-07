import { Database, type SQLQueryBindings } from "bun:sqlite";
import { DatabaseAdapter, QueryResult } from "./adapter";

export class SqliteAdapter implements DatabaseAdapter {
  readonly type = "sqlite" as const;
  private db: Database;

  constructor(filename: string) {
    this.db = new Database(filename);
    // Enable foreign keys
    this.db.run("PRAGMA foreign_keys = ON");
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    // Convert params to SQLite-compatible types (Date -> ISO string, undefined -> null)
    const bindings = (params ?? []).map((p) => {
      if (p instanceof Date) return p.toISOString();
      if (p === undefined) return null;
      return p;
    }) as SQLQueryBindings[];

    // Determine if this query returns rows
    const trimmed = sql.trim().toUpperCase();
    const returnsRows =
      trimmed.startsWith("SELECT") ||
      trimmed.startsWith("PRAGMA") ||
      trimmed.includes("RETURNING");

    if (returnsRows) {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...bindings) as T[];
      return {
        rows,
        rowCount: rows.length,
      };
    } else {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...bindings);
      return {
        rows: [] as T[],
        rowCount: result.changes,
      };
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }

  getDatabase(): Database {
    return this.db;
  }
}
