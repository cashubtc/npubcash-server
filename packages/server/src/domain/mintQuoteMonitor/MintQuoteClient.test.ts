import { describe, expect, test } from "bun:test";
import { FetchMintQuoteClient } from "./MintQuoteClient";

describe("FetchMintQuoteClient", () => {
  test("uses advertised NUT-29 batch size and preserves quote order", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const client = new FetchMintQuoteClient({
      fetch: async (input, init) => {
        const url = input.toString();
        requests.push({ url, init });
        if (url.endsWith("/v1/info")) {
          return new Response(
            JSON.stringify({
              nuts: {
                29: { max_batch_size: 2, methods: ["bolt11"] },
              },
            }),
          );
        }
        const body = JSON.parse(String(init?.body)) as { quotes: string[] };
        return new Response(
          JSON.stringify(
            body.quotes.map((quote) => ({
              quote,
              request: `lnbc-${quote}`,
              state: "PAID",
              expiry: 1_786_000_000,
            })),
          ),
        );
      },
      timeoutMs: 1_000,
    });

    const result = await client.checkQuotes(
      "https://mint.example.com/",
      ["quote-1", "quote-2", "quote-3"],
    );

    expect(result.kind).toBe("found");
    if (result.kind === "found") {
      expect(result.payloads.map((payload) => payload.quote)).toEqual([
        "quote-1",
        "quote-2",
        "quote-3",
      ]);
    }
    expect(requests.map((request) => request.url)).toEqual([
      "https://mint.example.com/v1/info",
      "https://mint.example.com/v1/mint/quote/bolt11/check",
      "https://mint.example.com/v1/mint/quote/bolt11/check",
    ]);
    expect(requests.slice(1).map((request) => request.init?.method)).toEqual([
      "POST",
      "POST",
    ]);
    expect(requests.slice(1).map((request) => request.init?.body)).toEqual([
      JSON.stringify({ quotes: ["quote-1", "quote-2"] }),
      JSON.stringify({ quotes: ["quote-3"] }),
    ]);
  });

  test("does not batch when the mint does not advertise NUT-29 for bolt11", async () => {
    const urls: string[] = [];
    const client = new FetchMintQuoteClient({
      fetch: async (input) => {
        urls.push(input.toString());
        return new Response(
          JSON.stringify({ nuts: { 29: { methods: ["bolt12"] } } }),
        );
      },
      timeoutMs: 1_000,
    });

    expect(
      await client.checkQuotes("https://mint.example.com", ["quote-1"]),
    ).toEqual({ kind: "unsupported" });
    expect(urls).toEqual(["https://mint.example.com/v1/info"]);
  });

  test("rejects a batch response that does not match request order", async () => {
    const responses = [
      new Response(JSON.stringify({ nuts: { 29: {} } })),
      new Response(
        JSON.stringify([
          {
            quote: "quote-2",
            request: "lnbc2",
            state: "PAID",
            expiry: 1_786_000_000,
          },
          {
            quote: "quote-1",
            request: "lnbc1",
            state: "PAID",
            expiry: 1_786_000_000,
          },
        ]),
      ),
    ];
    const client = new FetchMintQuoteClient({
      fetch: async () => responses.shift()!,
      timeoutMs: 1_000,
    });

    expect(
      (
        await client.checkQuotes("https://mint.example.com", [
          "quote-1",
          "quote-2",
        ])
      ).kind,
    ).toBe("invalid_response");
  });

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

  test("classifies rate limiting as a mint-wide outage", async () => {
    const client = new FetchMintQuoteClient({
      fetch: async () => new Response("slow down", { status: 429 }),
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
