import { describe, expect, test } from "bun:test";
import type { MintRequestBudget } from "./MintRequestBudget";
import { BudgetedMintRequestExecutor } from "./MintRequestExecutor";
import { FetchMintInfoLoader } from "./FetchMintInfoLoader";

class RecordingBudget implements MintRequestBudget {
  readonly mintUrls: string[] = [];

  async schedule<T>(
    mintUrl: string,
    request: () => Promise<T> | T,
  ): Promise<T> {
    this.mintUrls.push(mintUrl);
    return request();
  }
}

describe("FetchMintInfoLoader", () => {
  test("loads normalized mint info through the shared request budget", async () => {
    const budget = new RecordingBudget();
    const requests: Array<{ url: string; signal?: AbortSignal }> = [];
    const loader = new FetchMintInfoLoader({
      requestExecutor: new BudgetedMintRequestExecutor({
        requestBudget: budget,
      }),
      fetch: async (input, init) => {
        requests.push({
          url: input.toString(),
          signal: init?.signal ?? undefined,
        });
        return new Response(JSON.stringify({ nuts: { 29: {} } }));
      },
    });

    await expect(
      loader.getMintInfo("HTTPS://MINT.EXAMPLE.COM/"),
    ).resolves.toMatchObject({ nuts: { 29: {} } });
    expect(budget.mintUrls).toEqual(["HTTPS://MINT.EXAMPLE.COM/"]);
    expect(requests).toEqual([
      {
        url: "https://mint.example.com/v1/info",
        signal: expect.any(AbortSignal),
      },
    ]);
  });

  test("rejects mint info without capabilities", async () => {
    const loader = new FetchMintInfoLoader({
      requestExecutor: new BudgetedMintRequestExecutor({
        requestBudget: new RecordingBudget(),
      }),
      fetch: async () => new Response(JSON.stringify({ name: "broken" })),
    });

    await expect(
      loader.getMintInfo("https://mint.example.com"),
    ).rejects.toThrow("did not include NUT capabilities");
  });
});
