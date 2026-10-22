import { describe, expect, test } from "bun:test";
import {
  MintOperationError,
  NetworkError,
} from "@cashu/cashu-ts";
import type { MintRequestBudget } from "./MintRequestBudget";
import { BudgetedMintRequestExecutor } from "./MintRequestExecutor";
import { createCashuMintRequest } from "./CashuMintRequest";

const immediateBudget: MintRequestBudget = {
  schedule: async (_mintUrl, request) => request(),
};

describe("createCashuMintRequest", () => {
  test("uses the executor signal and cashu request shape", async () => {
    const executor = new BudgetedMintRequestExecutor({
      requestBudget: immediateBudget,
      timeoutMs: 1_000,
    });
    let requestInit: RequestInit | undefined;
    const request = createCashuMintRequest({
      mintUrl: "HTTPS://MINT.EXAMPLE.COM/",
      requestExecutor: executor,
      fetch: async (_input, init) => {
        requestInit = init;
        return Response.json({ ok: true });
      },
    });

    await expect(
      request<{ ok: boolean }>({
        endpoint: "https://mint.example.com/v1/test",
        method: "POST",
        headers: { Authorization: "Bearer token" },
        requestBody: { amount: 21 },
      }),
    ).resolves.toEqual({ ok: true });

    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.signal).toBeInstanceOf(AbortSignal);
    expect(requestInit?.body).toBe(JSON.stringify({ amount: 21 }));
    expect(new Headers(requestInit?.headers)).toEqual(
      new Headers({
        Accept: "application/json, text/plain, */*",
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      }),
    );
  });

  test("preserves cashu protocol and HTTP error types", async () => {
    const executor = new BudgetedMintRequestExecutor({
      requestBudget: immediateBudget,
    });
    const protocolRequest = createCashuMintRequest({
      mintUrl: "https://mint.example.com",
      requestExecutor: executor,
      fetch: async () =>
        Response.json({ code: 10001, detail: "quote not found" }, { status: 400 }),
    });
    const httpRequest = createCashuMintRequest({
      mintUrl: "https://mint.example.com",
      requestExecutor: executor,
      fetch: async () =>
        Response.json({ error: "mint unavailable" }, { status: 503 }),
    });

    await expect(
      protocolRequest({ endpoint: "https://mint.example.com/v1/test" }),
    ).rejects.toBeInstanceOf(MintOperationError);
    await expect(
      httpRequest({ endpoint: "https://mint.example.com/v1/test" }),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "mint unavailable",
        status: 503,
      }),
    );
  });

  test("maps fetch failures but preserves executor cancellation", async () => {
    const executor = new BudgetedMintRequestExecutor({
      requestBudget: immediateBudget,
      timeoutMs: 1,
    });
    const failedRequest = createCashuMintRequest({
      mintUrl: "https://mint.example.com",
      requestExecutor: executor,
      fetch: async () => {
        throw new Error("offline");
      },
    });
    const timedOutRequest = createCashuMintRequest({
      mintUrl: "https://mint.example.com",
      requestExecutor: executor,
      fetch: async (_input, init) =>
        new Promise<never>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
    });

    await expect(
      failedRequest({ endpoint: "https://mint.example.com/v1/test" }),
    ).rejects.toBeInstanceOf(NetworkError);
    await expect(
      timedOutRequest({ endpoint: "https://mint.example.com/v1/test" }),
    ).rejects.toThrow("Mint request timed out");
  });
});
