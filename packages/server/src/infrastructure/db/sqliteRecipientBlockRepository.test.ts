import { afterEach, beforeEach, expect, test } from "bun:test";
import { SqliteAdapter } from "@/database/sqliteAdapter";
import { runMigrations } from "@/migrations";
import { SqliteRecipientBlockRepository } from "./sqliteRecipientBlockRepository";

let adapter: SqliteAdapter;
let repository: SqliteRecipientBlockRepository;

beforeEach(async () => {
  adapter = new SqliteAdapter(":memory:");
  await runMigrations(adapter);
  repository = new SqliteRecipientBlockRepository(adapter);
});

afterEach(async () => {
  await adapter.close();
});

test("lists recipient blocks created through SQLite", async () => {
  const pubkey = "12".repeat(32);
  await adapter.query(
    "INSERT INTO recipient_blocks (pubkey, reason) VALUES (?, ?)",
    [pubkey, "operator context"],
  );

  const blocks = await repository.getAll();

  expect(blocks).toEqual([
    {
      pubkey,
      createdAt: expect.any(Date),
      reason: "operator context",
    },
  ]);
});
