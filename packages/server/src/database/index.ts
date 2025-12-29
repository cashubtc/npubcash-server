export * from "./adapter";

import { DatabaseAdapter, DatabaseType } from "./adapter";

export interface DatabaseConfig {
  type: DatabaseType;
  connectionString: string;
}

export async function createDatabaseAdapter(
  config: DatabaseConfig
): Promise<DatabaseAdapter> {
  if (config.type === "postgres") {
    try {
      const { PostgresAdapter } = await import("./postgresAdapter");
      return new PostgresAdapter(config.connectionString);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND") {
        throw new Error(
          'PostgreSQL driver not found. Please install it with: npm install pg\n' +
          'Or if using bun: bun add pg'
        );
      }
      throw e;
    }
  }

  if (config.type === "sqlite") {
    // bun:sqlite is built-in to Bun, no additional installation needed
    const { SqliteAdapter } = await import("./sqliteAdapter");
    return new SqliteAdapter(config.connectionString);
  }

  throw new Error(`Unsupported database type: ${config.type}`);
}
