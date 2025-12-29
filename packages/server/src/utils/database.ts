import { AppConfig } from "../config/index";
import { runMigrations } from "../migrations";
import { DatabaseAdapter, createDatabaseAdapter } from "../database";

const config = AppConfig.getInstance();

let adapter: DatabaseAdapter | null = null;

export async function setupDatabase() {
  adapter = await createDatabaseAdapter({
    type: config.dbType,
    connectionString: config.dbConnectionString,
  });
  await runMigrations(adapter);
}

export function getAdapter(): DatabaseAdapter {
  if (!adapter) {
    throw new Error("Database not initialized. Call setupDatabase() first.");
  }
  return adapter;
}

export function queryWrapper<T = Record<string, unknown>>(
  query: string,
  values: unknown[]
) {
  return getAdapter().query<T>(query, values);
}

export function createBulkInsertPayload(
  columnArray: string[],
  nestedValueArray: unknown[][]
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

export async function createBulkInsertQuery<T = Record<string, unknown>>(
  tableName: string,
  columnArray: string[],
  nestedValueArray: unknown[][]
) {
  const payload = createBulkInsertPayload(columnArray, nestedValueArray);
  const query = `INSERT INTO ${tableName} (${columnArray.join(",")}) VALUES ${
    payload.valueString
  };`;
  return getAdapter().query<T>(query, payload.flatValues);
}

export function createSanitizedValueString(n: number) {
  return `(${Array.from({ length: n }, (_, i) => `$${i + 1}`).join(", ")})`;
}
