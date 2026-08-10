import { RecipientBlockRepository } from "./recipientBlockRepository";

export interface RecipientBlocks {
  assertCanReceive(pubkey: string): Promise<void>;
}

export class RecipientBlockedError extends Error {
  constructor(readonly pubkey: string) {
    super("Recipient is blocked");
  }
}

export class RecipientBlockStorageError extends Error {
  constructor(
    readonly operation: "initial_load" | "refresh",
    readonly cause: unknown,
  ) {
    super(`Recipient block ${operation} failed`);
  }
}

const RECIPIENT_BLOCK_CACHE_TTL_MS = 5 * 60 * 1000;

interface RecipientBlockOptions {
  now?: () => number;
}

class SnapshotRecipientBlocks implements RecipientBlocks {
  private blockedPubkeys: ReadonlySet<string>;
  private refreshedAt: number;
  private refreshPromise?: Promise<void>;

  constructor(
    private readonly repository: RecipientBlockRepository,
    blocks: string[],
    private readonly now: () => number,
  ) {
    this.blockedPubkeys = new Set(blocks);
    this.refreshedAt = now();
  }

  async assertCanReceive(pubkey: string): Promise<void> {
    if (this.now() - this.refreshedAt >= RECIPIENT_BLOCK_CACHE_TTL_MS) {
      await this.refresh();
    }
    if (this.blockedPubkeys.has(pubkey)) {
      throw new RecipientBlockedError(pubkey);
    }
  }

  private async refresh(): Promise<void> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refresh = (async () => {
      let blocks;
      try {
        blocks = await this.repository.getAll();
      } catch (cause) {
        throw new RecipientBlockStorageError("refresh", cause);
      }
      this.blockedPubkeys = new Set(blocks.map((block) => block.pubkey));
      this.refreshedAt = this.now();
    })();
    this.refreshPromise = refresh;

    try {
      await refresh;
    } finally {
      if (this.refreshPromise === refresh) {
        this.refreshPromise = undefined;
      }
    }
  }
}

export async function createRecipientBlocks(
  repository: RecipientBlockRepository,
  options: RecipientBlockOptions = {},
): Promise<RecipientBlocks> {
  let blocks;
  try {
    blocks = await repository.getAll();
  } catch (cause) {
    throw new RecipientBlockStorageError("initial_load", cause);
  }
  return new SnapshotRecipientBlocks(
    repository,
    blocks.map((block) => block.pubkey),
    options.now ?? Date.now,
  );
}
