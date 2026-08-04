import { describe, expect, test } from "bun:test";
import { FetchMintQuoteClient } from "./MintQuoteClient";

describe("FetchMintQuoteClient", () => {
  test("classifies quote responses without throwing", async () => {
    const responses = [
      new Response(
        JSON.stringify({
          quote: "quote-1",
          request: "lnbc1",
          state: "PAID",
          expiry: 1_786_000_000,
        }),
        { status: 200 },
      ),
      new Response(JSON.stringify({ detail: "Quote not found" }), {
        status: 404,
      }),
      new Response("upstream failure", { status: 503 }),
      new Response(JSON.stringify({ state: "PAID" }), { status: 200 }),
    ];
    const client = new FetchMintQuoteClient({
      fetch: async () => responses.shift()!,
      timeoutMs: 1_000,
    });

    expect(await client.checkQuote("https://mint.example.com/", "quote-1"))
      .toEqual({
        kind: "found",
        payload: {
          quote: "quote-1",
          request: "lnbc1",
          state: "PAID",
          expiry: 1_786_000_000,
        },
      });
    expect(await client.checkQuote("https://mint.example.com", "missing"))
      .toEqual({ kind: "not_found" });
    expect(
      (await client.checkQuote("https://mint.example.com", "quote-1")).kind,
    ).toBe("mint_unavailable");
    expect(
      (await client.checkQuote("https://mint.example.com", "quote-1")).kind,
    ).toBe("invalid_response");
  });

  test("classifies a network rejection as mint unavailable", async () => {
    const client = new FetchMintQuoteClient({
      fetch: async () => {
        throw new Error("connection refused");
      },
      timeoutMs: 1_000,
    });

    expect(
      (await client.checkQuote("https://mint.example.com", "quote-1")).kind,
    ).toBe("mint_unavailable");
  });

  test("classifies every 5xx as mint unavailable even when its body says quote not found", async () => {
    const client = new FetchMintQuoteClient({
      fetch: async () =>
        new Response(JSON.stringify({ detail: "Quote not found" }), {
          status: 503,
        }),
      timeoutMs: 1_000,
    });

    expect(
      (await client.checkQuote("https://mint.example.com", "quote-1")).kind,
    ).toBe("mint_unavailable");
  });

  test("forwards caller cancellation to the underlying request", async () => {
    let requestSignal: AbortSignal | undefined;
    const client = new FetchMintQuoteClient({
      fetch: async (_input, init) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          requestSignal?.addEventListener("abort", () => reject(requestSignal?.reason), {
            once: true,
          });
        });
      },
      timeoutMs: 100,
    });
    const controller = new AbortController();

    const checking = client.checkQuote(
      "https://mint.example.com",
      "quote-1",
      controller.signal,
    );
    controller.abort(new Error("quote finished"));
    await Promise.resolve();

    expect(requestSignal?.aborted).toBe(true);
    await checking;
  });
});
