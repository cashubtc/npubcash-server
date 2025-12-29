export type DatabaseType = "postgres" | "sqlite";

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface DatabaseAdapter {
  type: DatabaseType;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
  close(): Promise<void>;
}
