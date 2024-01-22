import { Pool, QueryConfig, QueryResultRow } from "pg";

const pool = new Pool();

export function queryWrapper<T extends QueryResultRow>(
  query: string | QueryConfig<any[]>,
  values: any[],
) {
  return pool.query<T>(query, values);
}
