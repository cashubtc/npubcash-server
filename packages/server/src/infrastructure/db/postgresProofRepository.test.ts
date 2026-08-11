import { describe, expect, test } from "bun:test";
import { DatabaseAdapter, QueryResult } from "@/database/adapter";
import { PostgresProofRepository } from "./postgresProofRepository";

describe("PostgresProofRepository", () => {
  test("does not issue invalid SQL for an empty proof list", async () => {
    const queries: string[] = [];
    const adapter: DatabaseAdapter = {
      type: "postgres",
      async query<T = Record<string, unknown>>(
        sql: string,
        params: unknown[] = [],
      ): Promise<QueryResult<T>> {
        queries.push(sql);
        return { rows: [], rowCount: params.length / 5 };
      },
      async close() {},
    };

    const repository = new PostgresProofRepository(adapter);

    await repository.saveProofs([]);

    expect(queries).toEqual([]);
  });
});
