import { config } from "../config/index";
import { runMigrations } from "../migrations";
import { DatabaseAdapter, createDatabaseAdapter } from "../database";
import {
  createRepositories,
  Repositories,
} from "../infrastructure/db/repositoryFactory";
import { initializeAppServices } from "../config";
import { createBulkInsertPayload } from "./sql";

export { createBulkInsertPayload, createSanitizedValueString } from "./sql";

interface Persistence {
  adapter: DatabaseAdapter;
  repositories: Repositories;
}

let persistence: Persistence | null = null;

export async function setupDatabase() {
  const adapter = await createDatabaseAdapter({
    type: config.dbType,
    connectionString: config.dbConnectionString,
  });
  try {
    await runMigrations(adapter);
    const repositories = createRepositories(adapter, { mintUrl: config.mintUrl });
    persistence = { adapter, repositories };
    initializeAppServices(repositories);
  } catch (error) {
    await adapter.close();
    throw error;
  }
}

export function getPersistence(): Persistence {
  if (!persistence) {
    throw new Error("Database not initialized. Call setupDatabase() first.");
  }
  return persistence;
}

export function getAdapter(): DatabaseAdapter {
  return getPersistence().adapter;
}

export function getRepositories(): Repositories {
  return getPersistence().repositories;
}

export function queryWrapper<T = Record<string, unknown>>(
  query: string,
  values: unknown[]
) {
  return getAdapter().query<T>(query, values);
}

export async function createBulkInsertQuery<T = Record<string, unknown>>(
  tableName: string,
  columnArray: string[],
  nestedValueArray: unknown[][],
) {
  const payload = createBulkInsertPayload(columnArray, nestedValueArray);
  const query = `INSERT INTO ${tableName} (${columnArray.join(",")}) VALUES ${
    payload.valueString
  };`;
  return getAdapter().query<T>(query, payload.flatValues);
}
