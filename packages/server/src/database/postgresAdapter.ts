import pg from "pg";
import { DatabaseAdapter, QueryResult } from "./adapter";

export class PostgresAdapter implements DatabaseAdapter {
  readonly type = "postgres" as const;
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString });
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const result = await this.pool.query(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  getPool(): pg.Pool {
    return this.pool;
  }
}
