import { describe, expect, test } from "bun:test";
import type { MintRequestBudget } from "./MintRequestBudget";
import { BudgetedMintRequestExecutor } from "./MintRequestExecutor";

const immediateBudget: MintRequestBudget = {
  schedule: async (_mintUrl, request) => request(),
};

describe("BudgetedMintRequestExecutor", () => {
  test("forwards caller cancellation to a running request", async () => {
    const executor = new BudgetedMintRequestExecutor({
      requestBudget: immediateBudget,
      timeoutMs: 1_000,
    });
    const controller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const running = executor.run(
      "https://mint.example.com",
      controller.signal,
      async (signal) => {
        requestSignal = signal;
        return new Promise<never>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      },
    );

    controller.abort(new Error("stopped"));

    await expect(running).rejects.toThrow("stopped");
    expect(requestSignal?.aborted).toBe(true);
  });

  test("starts the timeout when budgeted work begins", async () => {
    const executor = new BudgetedMintRequestExecutor({
      requestBudget: immediateBudget,
      timeoutMs: 1,
    });

    await expect(
      executor.run(
        "https://mint.example.com",
        undefined,
        async (signal) =>
          new Promise<never>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            });
          }),
      ),
    ).rejects.toThrow("Mint request timed out");
  });
});
