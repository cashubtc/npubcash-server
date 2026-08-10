import { expect, test } from "bun:test";
import {
  createRecipientBlocks,
  RecipientBlockedError,
  RecipientBlockStorageError,
} from "./RecipientBlocks";
import type { RecipientBlockRepository } from "./recipientBlockRepository";

test("rejects a public key present in the initial recipient block snapshot", async () => {
  const blockedPubkey = "56".repeat(32);
  const repository: RecipientBlockRepository = {
    getAll: async () => [
      {
        pubkey: blockedPubkey,
        createdAt: new Date("2026-08-10T12:00:00.000Z"),
        reason: null,
      },
    ],
  };
  const recipientBlocks = await createRecipientBlocks(repository);

  await expect(
    recipientBlocks.assertCanReceive(blockedPubkey),
  ).rejects.toBeInstanceOf(RecipientBlockedError);
  await expect(
    recipientBlocks.assertCanReceive("78".repeat(32)),
  ).resolves.toBeUndefined();
});

test("refreshes the complete snapshot after five minutes", async () => {
  const firstPubkey = "9a".repeat(32);
  const secondPubkey = "bc".repeat(32);
  let now = 1_000_000;
  let reads = 0;
  const repository: RecipientBlockRepository = {
    getAll: async () => {
      reads += 1;
      return [
        {
          pubkey: reads === 1 ? firstPubkey : secondPubkey,
          createdAt: new Date("2026-08-10T12:00:00.000Z"),
          reason: null,
        },
      ];
    },
  };
  const recipientBlocks = await createRecipientBlocks(repository, {
    now: () => now,
  });

  now += 299_999;
  await expect(
    recipientBlocks.assertCanReceive(secondPubkey),
  ).resolves.toBeUndefined();
  expect(reads).toBe(1);

  now += 1;
  await expect(
    recipientBlocks.assertCanReceive(secondPubkey),
  ).rejects.toBeInstanceOf(RecipientBlockedError);
  await expect(
    recipientBlocks.assertCanReceive(firstPubkey),
  ).resolves.toBeUndefined();
  expect(reads).toBe(2);
});

test("coalesces concurrent refreshes into one repository read", async () => {
  const blockedPubkey = "de".repeat(32);
  let now = 0;
  let reads = 0;
  let completeRefresh!: (
    blocks: Awaited<ReturnType<RecipientBlockRepository["getAll"]>>,
  ) => void;
  const pendingRefresh = new Promise<
    Awaited<ReturnType<RecipientBlockRepository["getAll"]>>
  >((resolve) => {
    completeRefresh = resolve;
  });
  const repository: RecipientBlockRepository = {
    getAll: async () => {
      reads += 1;
      return reads === 1 ? [] : pendingRefresh;
    },
  };
  const recipientBlocks = await createRecipientBlocks(repository, {
    now: () => now,
  });
  now = 300_000;

  const blockedCheck = recipientBlocks.assertCanReceive(blockedPubkey);
  const allowedCheck = recipientBlocks.assertCanReceive("f0".repeat(32));
  await Promise.resolve();

  expect(reads).toBe(2);
  completeRefresh([
    {
      pubkey: blockedPubkey,
      createdAt: new Date("2026-08-10T12:00:00.000Z"),
      reason: null,
    },
  ]);
  await expect(blockedCheck).rejects.toBeInstanceOf(RecipientBlockedError);
  await expect(allowedCheck).resolves.toBeUndefined();
});

test("fails initial loading with a typed storage error", async () => {
  const repository: RecipientBlockRepository = {
    getAll: async () => {
      throw new Error("database offline");
    },
  };

  await expect(createRecipientBlocks(repository)).rejects.toBeInstanceOf(
    RecipientBlockStorageError,
  );
});

test("rejects an expired snapshot on refresh failure and retries on the next request", async () => {
  const oldPubkey = "11".repeat(32);
  const newPubkey = "22".repeat(32);
  let now = 0;
  let reads = 0;
  const repository: RecipientBlockRepository = {
    getAll: async () => {
      reads += 1;
      if (reads === 2) {
        throw new Error("database offline");
      }
      return [
        {
          pubkey: reads === 1 ? oldPubkey : newPubkey,
          createdAt: new Date("2026-08-10T12:00:00.000Z"),
          reason: null,
        },
      ];
    },
  };
  const recipientBlocks = await createRecipientBlocks(repository, {
    now: () => now,
  });
  now = 300_000;

  await expect(
    recipientBlocks.assertCanReceive("33".repeat(32)),
  ).rejects.toBeInstanceOf(RecipientBlockStorageError);
  await expect(
    recipientBlocks.assertCanReceive(newPubkey),
  ).rejects.toBeInstanceOf(RecipientBlockedError);
  await expect(
    recipientBlocks.assertCanReceive(oldPubkey),
  ).resolves.toBeUndefined();
  expect(reads).toBe(3);
});
