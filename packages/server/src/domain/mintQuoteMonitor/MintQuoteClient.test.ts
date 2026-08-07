import { describe, expect, test } from "bun:test";
import { FetchMintQuoteClient, isMintQuotePayload } from "./MintQuoteClient";

describe("FetchMintQuoteClient", () => {
  test("accepts numeric, null, or omitted quote expiry", () => {
    const payload = {
      quote: "quote-1",
      request: "lnbc1",
      state: "UNPAID",
    } as const;

    expect(isMintQuotePayload({ ...payload, expiry: 1_786_000_000 })).toBe(
      true,
    );
    expect(isMintQuotePayload({ ...payload, expiry: null })).toBe(true);
    expect(isMintQuotePayload(payload)).toBe(true);
    expect(isMintQuotePayload({ ...payload, expiry: "never" })).toBe(false);
    expect(isMintQuotePayload({ ...payload, expiry: Number.NaN })).toBe(false);
  });

  test("paces every HTTP request to the same mint", async () => {
    let now = 0;
    const waits: number[] = [];
    const starts: Array<{ at: number; url: string }> = [];
    const client = new FetchMintQuoteClient({
      fetch: async (input, init) => {
        const url = input.toString();
        starts.push({ at: now, url });
        if (url.endsWith("/v1/info")) {
          return new Response(
            JSON.stringify({
              nuts: {
                29: { max_batch_size: 2, methods: ["bolt11"] },
              },
            }),
          );
        }
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body)) as { quotes: string[] };
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
        }
        const quote = decodeURIComponent(url.split("/").at(-1)!);
        return new Response(
          JSON.stringify({
            quote,
            request: `lnbc-${quote}`,
            state: "PAID",
            expiry: 1_786_000_000,
          }),
        );
      },
      timeoutMs: 1_000,
      rateLimit: {
        capacity: 1,
        refillPerMinute: 60,
        now: () => now,
        wait: async (delayMs) => {
          waits.push(delayMs);
          now += delayMs;
        },
      },
    });

    await client.checkQuotes("https://mint.example.com/", [
      "quote-1",
      "quote-2",
      "quote-3",
    ]);
    await client.checkQuote("https://mint.example.com", "quote-4");

    expect(starts.map(({ at }) => at)).toEqual([0, 1_000, 2_000, 3_000]);
    expect(waits).toEqual([1_000, 1_000, 1_000]);
  });

  test("maintains independent token buckets for different mints", async () => {
    let now = 0;
    const starts: Array<{ at: number; url: string }> = [];
    const client = new FetchMintQuoteClient({
      fetch: async (input) => {
        const url = input.toString();
        starts.push({ at: now, url });
        const quote = decodeURIComponent(url.split("/").at(-1)!);
        return new Response(
          JSON.stringify({
            quote,
            request: `lnbc-${quote}`,
            state: "PAID",
            expiry: 1_786_000_000,
          }),
        );
      },
      timeoutMs: 1_000,
      rateLimit: {
        capacity: 1,
        refillPerMinute: 60,
        now: () => now,
        wait: async (delayMs) => {
          now += delayMs;
        },
      },
    });

    await client.checkQuote("https://mint-a.example.com", "quote-a-1");
    await client.checkQuote("https://mint-b.example.com", "quote-b-1");
    await client.checkQuote("https://mint-a.example.com", "quote-a-2");

    expect(starts.map(({ at }) => at)).toEqual([0, 0, 1_000]);
  });

  test("rate limits concurrent requests to the same mint", async () => {
    let now = 0;
    const starts: Array<{ at: number; url: string }> = [];
    const client = new FetchMintQuoteClient({
      fetch: async (input) => {
        const url = input.toString();
        starts.push({ at: now, url });
        const quote = decodeURIComponent(url.split("/").at(-1)!);
        return new Response(
          JSON.stringify({
            quote,
            request: `lnbc-${quote}`,
            state: "PAID",
            expiry: 1_786_000_000,
          }),
        );
      },
      timeoutMs: 1_000,
      rateLimit: {
        capacity: 1,
        refillPerMinute: 60,
        now: () => now,
        wait: async (delayMs) => {
          now += delayMs;
        },
      },
    });

    const first = client.checkQuote("https://mint.example.com", "quote-1");
    const second = client.checkQuote("https://mint.example.com", "quote-2");

    await Promise.all([first, second]);
    expect(starts.map(({ at }) => at)).toEqual([0, 1_000]);
    expect(starts.map(({ url }) => url)).toEqual([
      "https://mint.example.com/v1/mint/quote/bolt11/quote-1",
      "https://mint.example.com/v1/mint/quote/bolt11/quote-2",
    ]);
  });

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
      rateLimit: { capacity: 100 },
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
      rateLimit: { capacity: 100 },
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
      rateLimit: { capacity: 100 },
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
      rateLimit: { capacity: 100 },
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
      rateLimit: { capacity: 100 },
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
      rateLimit: { capacity: 100 },
    });

    expect(
      (await client.checkQuote("https://mint.example.com", "quote-1")).kind,
    ).toBe("mint_unavailable");
  });

  test("classifies rate limiting as a mint-wide outage", async () => {
    const client = new FetchMintQuoteClient({
      fetch: async () => new Response("slow down", { status: 429 }),
      timeoutMs: 1_000,
      rateLimit: { capacity: 100 },
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
      rateLimit: { capacity: 100 },
    });
    const controller = new AbortController();

    const checking = client.checkQuote(
      "https://mint.example.com",
      "quote-1",
      controller.signal,
    );
    for (let turn = 0; turn < 10 && !requestSignal; turn += 1) {
      await Promise.resolve();
    }
    controller.abort(new Error("quote finished"));
    await Promise.resolve();

    expect(requestSignal?.aborted).toBe(true);
    await checking;
  });

  test("does not send a request cancelled while waiting for a token", async () => {
    let now = 0;
    let releaseWait!: () => void;
    const waiting = new Promise<void>((resolve) => {
      releaseWait = resolve;
    });
    const urls: string[] = [];
    const client = new FetchMintQuoteClient({
      fetch: async (input) => {
        const url = input.toString();
        urls.push(url);
        const quote = decodeURIComponent(url.split("/").at(-1)!);
        return new Response(
          JSON.stringify({
            quote,
            request: `lnbc-${quote}`,
            state: "PAID",
            expiry: 1_786_000_000,
          }),
        );
      },
      timeoutMs: 1_000,
      rateLimit: {
        capacity: 1,
        refillPerMinute: 60,
        now: () => now,
        wait: async (delayMs) => {
          await waiting;
          now += delayMs;
        },
      },
    });

    await client.checkQuote("https://mint.example.com", "quote-1");
    const controller = new AbortController();
    const checking = client.checkQuote(
      "https://mint.example.com",
      "quote-2",
      controller.signal,
    );
    controller.abort(new Error("quote finished"));

    expect((await checking).kind).toBe("mint_unavailable");
    releaseWait();
    await Promise.resolve();
    await Promise.resolve();
    expect(urls).toEqual([
      "https://mint.example.com/v1/mint/quote/bolt11/quote-1",
    ]);
  });
});
