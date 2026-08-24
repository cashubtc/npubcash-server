import type { MintRequestBudget } from "./MintRequestBudget";

export interface MintRequestExecutor {
  run<T>(
    mintUrl: string,
    signal: AbortSignal | undefined,
    request: (signal: AbortSignal) => Promise<T>,
  ): Promise<T>;
}

interface BudgetedMintRequestExecutorOptions {
  requestBudget: MintRequestBudget;
  timeoutMs?: number;
}

export class BudgetedMintRequestExecutor implements MintRequestExecutor {
  private readonly requestBudget: MintRequestBudget;
  private readonly timeoutMs: number;

  constructor(options: BudgetedMintRequestExecutorOptions) {
    this.requestBudget = options.requestBudget;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  run<T>(
    mintUrl: string,
    signal: AbortSignal | undefined,
    request: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    return this.requestBudget.schedule(
      mintUrl,
      () => this.withRequestSignal(signal, request),
      signal,
    );
  }

  private async withRequestSignal<T>(
    signal: AbortSignal | undefined,
    request: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error("Mint request timed out")),
      this.timeoutMs,
    );
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) {
      abortFromCaller();
    } else {
      signal?.addEventListener("abort", abortFromCaller, { once: true });
    }

    try {
      return await request(controller.signal);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}
