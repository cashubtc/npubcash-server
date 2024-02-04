import { Pool, QueryConfig, QueryResultRow } from "pg";

const pool = new Pool();

export function queryWrapper<T extends QueryResultRow>(
  query: string | QueryConfig<any[]>,
  values: any[],
) {
  return pool.query<T>(query, values);
}

export function createBulkInsertPayload(
  columnArray: string[],
  nestedValueArray: any[][],
) {
  let counter = 1;
  const sanitizedValueArray: string[] = [];
  nestedValueArray.forEach((innerArray) => {
    if (columnArray.length !== innerArray.length) {
      throw new Error("Value-Column mismatch");
    }
    const innerSanitizedValueArray: string[] = [];
    for (let i = 0; i < innerArray.length; i++) {
      innerSanitizedValueArray.push(`$${counter}`);
      counter++;
    }
    sanitizedValueArray.push(innerSanitizedValueArray.join(","));
  });
  const valueStrings = sanitizedValueArray
    .map((innerValue) => `(${innerValue})`)
    .join(",");
  return { valueString: valueStrings, flatValues: nestedValueArray.flat() };
}

export function createBulkInsertQuery<T extends QueryResultRow>(
  tableName: string,
  columnArray: string[],
  nestedValueArray: any[][],
) {
  const payload = createBulkInsertPayload(columnArray, nestedValueArray);
  const query = `INSERT INTO ${tableName} (${columnArray.join(",")}) VALUES ${
    payload.valueString
  };`;
  return pool.query<T>(query, payload.flatValues);
}
