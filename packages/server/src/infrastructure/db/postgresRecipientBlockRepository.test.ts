import { expect, test } from "bun:test";
import type { DatabaseAdapter, QueryResult } from "@/database/adapter";
import { PostgresRecipientBlockRepository } from "./postgresRecipientBlockRepository";

class RecipientBlockPostgresAdapter implements DatabaseAdapter {
  readonly type = "postgres" as const;

  async query<T = Record<string, unknown>>(): Promise<QueryResult<T>> {
    return {
      rows: [
        {
          pubkey: "34".repeat(32),
          created_at: new Date("2026-08-10T12:00:00.000Z"),
          reason: null,
        },
      ] as T[],
      rowCount: 1,
    };
  }

  async close(): Promise<void> {}
}

test("lists recipient blocks returned by PostgreSQL", async () => {
  const repository = new PostgresRecipientBlockRepository(
    new RecipientBlockPostgresAdapter(),
  );

  const blocks = await repository.getAll();

  expect(blocks).toEqual([
    {
      pubkey: "34".repeat(32),
      createdAt: new Date("2026-08-10T12:00:00.000Z"),
      reason: null,
    },
  ]);
});
