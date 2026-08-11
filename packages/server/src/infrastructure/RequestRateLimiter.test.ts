import { describe, expect, test } from "bun:test";
import { RequestRateLimiter } from "./RequestRateLimiter";

describe("RequestRateLimiter", () => {
  test("defaults to one-token capacity and 20 refills per minute", async () => {
    let now = 0;
    const starts: number[] = [];
    const limiter = new RequestRateLimiter({
      now: () => now,
      wait: async (delayMs) => {
        now += delayMs;
      },
    });

    const requests = [1, 2].map((id) =>
      limiter.schedule(() => {
        starts.push(now);
        return id;
      }),
    );

    expect(await Promise.all(requests)).toEqual([1, 2]);
    expect(starts).toEqual([0, 3_000]);
  });

  test("starts with a full bucket and refills queued work FIFO", async () => {
    let now = 0;
    const waits: number[] = [];
    const starts: Array<{ id: number; at: number }> = [];
    const limiter = new RequestRateLimiter({
      capacity: 2,
      refillPerMinute: 60,
      now: () => now,
      wait: async (delayMs) => {
        waits.push(delayMs);
        now += delayMs;
      },
    });

    const requests = [1, 2, 3, 4].map((id) =>
      limiter.schedule(() => {
        starts.push({ id, at: now });
        return id;
      }),
    );

    expect(await Promise.all(requests)).toEqual([1, 2, 3, 4]);
    expect(starts).toEqual([
      { id: 1, at: 0 },
      { id: 2, at: 0 },
      { id: 3, at: 1_000 },
      { id: 4, at: 2_000 },
    ]);
    expect(waits).toEqual([1_000, 1_000]);
  });

  test("rate limits starts without waiting for in-flight work", async () => {
    let now = 0;
    let finishFirst!: () => void;
    const firstFinished = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const starts: Array<{ id: number; at: number }> = [];
    const limiter = new RequestRateLimiter({
      capacity: 1,
      refillPerMinute: 60,
      now: () => now,
      wait: async (delayMs) => {
        now += delayMs;
      },
    });

    const first = limiter.schedule(async () => {
      starts.push({ id: 1, at: now });
      await firstFinished;
    });
    const second = limiter.schedule(() => {
      starts.push({ id: 2, at: now });
    });

    await second;
    expect(starts).toEqual([
      { id: 1, at: 0 },
      { id: 2, at: 1_000 },
    ]);
    finishFirst();
    await first;
  });

  test("cancels queued work without executing it", async () => {
    let now = 0;
    let releaseWait!: () => void;
    const waiting = new Promise<void>((resolve) => {
      releaseWait = resolve;
    });
    let queuedRequestStarted = false;
    const limiter = new RequestRateLimiter({
      capacity: 1,
      refillPerMinute: 60,
      now: () => now,
      wait: async (delayMs) => {
        await waiting;
        now += delayMs;
      },
    });

    await limiter.schedule(() => undefined);
    const controller = new AbortController();
    const queued = limiter.schedule(() => {
      queuedRequestStarted = true;
    }, controller.signal);
    controller.abort(new Error("request no longer needed"));

    await expect(queued).rejects.toThrow("request no longer needed");
    releaseWait();
    await Promise.resolve();
    await Promise.resolve();
    expect(queuedRequestStarted).toBe(false);
  });

  test("rejects invalid bucket configuration", () => {
    expect(() => new RequestRateLimiter({ capacity: 0 })).toThrow(
      "capacity must be a positive integer",
    );
    expect(
      () => new RequestRateLimiter({ refillPerMinute: Number.NaN }),
    ).toThrow("refillPerMinute must be a positive number");
  });
});
