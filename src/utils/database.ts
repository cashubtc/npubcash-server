import { Pool, QueryConfig, QueryResultRow } from "pg";
import migrate from "node-pg-migrate";
import path from "path";

const pool = new Pool();

export async function setupDatabase() {
  const dbConfig = {
    connectionString: `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
  };

  await migrate({
    databaseUrl: dbConfig.connectionString,
    dir: path.resolve(__dirname, "migrations"),
    direction: "up",
    migrationsTable: "pgmigrations",
    count: Infinity,
    log: console.log,
  });
}

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

export function createSanitizedValueString(n) {
  return `(${Array.from({ length: n }, (_, i) => `$${i + 1}`).join(", ")})`;
}
