export interface RequestRateLimiterOptions {
  capacity?: number;
  refillPerMinute?: number;
  now?: () => number;
  wait?: (delayMs: number) => Promise<void>;
}

interface QueuedRequest {
  readonly cancelled: boolean;
  start(): void;
  cancel(reason: unknown): void;
}

const waitForDelay = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

/**
 * FIFO token-bucket limiter for asynchronous work.
 *
 * Capacity controls the maximum burst size. Tokens refill continuously at
 * `refillPerMinute`; work waits in insertion order when no token is available.
 */
export class RequestRateLimiter {
  private readonly capacity: number;
  private readonly refillPerMinute: number;
  private readonly now: () => number;
  private readonly wait: (delayMs: number) => Promise<void>;
  private tokens: number;
  private lastRefillAt: number;
  private readonly queue: QueuedRequest[] = [];
  private draining = false;

  constructor(options: RequestRateLimiterOptions = {}) {
    this.capacity = this.requirePositiveInteger(
      "capacity",
      options.capacity ?? 1,
    );
    this.refillPerMinute = this.requirePositiveNumber(
      "refillPerMinute",
      options.refillPerMinute ?? 25,
    );
    this.now = options.now ?? Date.now;
    this.wait = options.wait ?? waitForDelay;
    this.tokens = this.capacity;
    this.lastRefillAt = this.now();
  }

  schedule<T>(request: () => Promise<T> | T, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) {
      return Promise.reject(signal.reason ?? new Error("Request aborted"));
    }

    return new Promise<T>((resolve, reject) => {
      let started = false;
      let cancelled = false;

      const removeAbortListener = () =>
        signal?.removeEventListener("abort", abort);
      const abort = () => {
        if (started || cancelled) return;
        cancelled = true;
        removeAbortListener();
        reject(signal?.reason ?? new Error("Request aborted"));
      };
      const queuedRequest: QueuedRequest = {
        get cancelled() {
          return cancelled;
        },
        start: () => {
          if (cancelled) return;
          started = true;
          removeAbortListener();
          try {
            Promise.resolve(request()).then(resolve, reject);
          } catch (cause) {
            reject(cause);
          }
        },
        cancel: (reason) => {
          if (started || cancelled) return;
          cancelled = true;
          removeAbortListener();
          reject(reason);
        },
      };

      signal?.addEventListener("abort", abort, { once: true });
      this.queue.push(queuedRequest);
      this.startDraining();
    });
  }

  private startDraining(): void {
    if (this.draining) return;
    void this.drainQueue();
  }

  private async drainQueue(): Promise<void> {
    this.draining = true;
    try {
      while (true) {
        while (this.queue[0]?.cancelled) this.queue.shift();
        if (this.queue.length === 0) return;

        this.refillTokens();
        if (this.tokens < 1) {
          await this.wait(this.msUntilNextToken());
          continue;
        }

        const next = this.queue.shift();
        if (!next || next.cancelled) continue;
        this.tokens -= 1;
        next.start();
      }
    } catch (cause) {
      for (const queuedRequest of this.queue.splice(0)) {
        queuedRequest.cancel(cause);
      }
    } finally {
      this.draining = false;
      if (this.queue.length > 0) this.startDraining();
    }
  }

  private refillTokens(): void {
    const now = this.now();
    const elapsedMs = now - this.lastRefillAt;
    if (elapsedMs <= 0) return;

    const tokensPerMs = this.refillPerMinute / 60_000;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsedMs * tokensPerMs,
    );
    this.lastRefillAt = now;
  }

  private msUntilNextToken(): number {
    const tokensPerMs = this.refillPerMinute / 60_000;
    return Math.max(1, Math.ceil((1 - this.tokens) / tokensPerMs));
  }

  private requirePositiveInteger(name: string, value: number): number {
    if (!Number.isInteger(value) || value <= 0) {
      throw new RangeError(`${name} must be a positive integer`);
    }
    return value;
  }

  private requirePositiveNumber(name: string, value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${name} must be a positive number`);
    }
    return value;
  }
}
