import { Pool, QueryResultRow } from "pg";

const pool = new Pool();

export function queryWrapper<T extends QueryResultRow>(
  query: string,
  values: string[],
) {
  return pool.query<T>(query, values);
}
