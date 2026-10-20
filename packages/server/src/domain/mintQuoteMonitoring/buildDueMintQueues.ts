import { normalizeUrl } from "@/utils/utils";
import type { DueMintQueue } from "./MintQuoteMonitoringStore";

export interface StoredDueMintQueue {
  mintUrl: string;
  oldestDueAt: Date | string | null;
}

export function buildDueMintQueues(
  storedQueues: readonly StoredDueMintQueue[],
  limit: number,
  excludedMintUrls: readonly string[],
): DueMintQueue[] {
  const excluded = new Set(excludedMintUrls);
  const queues = new Map<string, DueMintQueue>();
  for (const storedQueue of storedQueues) {
    const mintUrl = normalizeUrl(storedQueue.mintUrl);
    if (excluded.has(mintUrl)) continue;
    const oldestDueAt = storedQueue.oldestDueAt
      ? new Date(storedQueue.oldestDueAt)
      : null;
    const queue = queues.get(mintUrl);
    if (!queue) {
      queues.set(mintUrl, {
        mintUrl,
        mintUrlAliases: [storedQueue.mintUrl],
        oldestDueAt,
      });
      continue;
    }

    queues.set(mintUrl, {
      ...queue,
      mintUrlAliases: [...queue.mintUrlAliases, storedQueue.mintUrl],
      oldestDueAt: earlierPollingTime(queue.oldestDueAt, oldestDueAt),
    });
  }

  return [...queues.values()].sort(compareDueMintQueues).slice(0, limit);
}

function earlierPollingTime(
  first: Date | null,
  second: Date | null,
): Date | null {
  if (first === null || second === null) return null;
  return first <= second ? first : second;
}

function compareDueMintQueues(
  first: DueMintQueue,
  second: DueMintQueue,
): number {
  if (first.oldestDueAt === null && second.oldestDueAt !== null) return -1;
  if (first.oldestDueAt !== null && second.oldestDueAt === null) return 1;
  const timeDifference =
    (first.oldestDueAt?.getTime() ?? 0) - (second.oldestDueAt?.getTime() ?? 0);
  return timeDifference || first.mintUrl.localeCompare(second.mintUrl);
}
