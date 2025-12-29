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
    // Convert PostgreSQL syntax to SQLite
    const sqliteQuery = this.convertToSqlite(sql);
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
      const stmt = this.db.prepare(sqliteQuery);
      const rows = stmt.all(...bindings) as T[];
      return {
        rows,
        rowCount: rows.length,
      };
    } else {
      const stmt = this.db.prepare(sqliteQuery);
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

  private convertToSqlite(sql: string): string {
    let result = sql;

    // Replace NOW() with datetime('now')
    result = result.replace(/\bNOW\(\)/gi, "datetime('now')");

    // Replace $1, $2, etc. with ?
    result = this.convertPlaceholders(result);

    return result;
  }

  private convertPlaceholders(sql: string): string {
    // Replace $1, $2, etc. with ?
    // Be careful not to replace $1 inside strings
    let result = "";
    let inString = false;
    let stringChar = "";
    let i = 0;

    while (i < sql.length) {
      const char = sql[i];

      // Track string boundaries
      if ((char === "'" || char === '"') && sql[i - 1] !== "\\") {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      // Replace $N with ? when not in a string
      if (!inString && char === "$" && /\d/.test(sql[i + 1] ?? "")) {
        result += "?";
        i++;
        // Skip all following digits
        while (/\d/.test(sql[i] ?? "")) {
          i++;
        }
        continue;
      }

      result += char;
      i++;
    }

    return result;
  }
}
