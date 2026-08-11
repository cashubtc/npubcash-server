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

    await client.checkQuotes(
      "https://mint.example.com/",
      ["quote-1", "quote-2", "quote-3"],
      2,
    );
    await client.checkQuote("https://mint.example.com", "quote-4");

    expect(starts.map(({ at }) => at)).toEqual([0, 1_000, 2_000]);
    expect(waits).toEqual([1_000, 1_000]);
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

  test("reports when an individual quote request actually starts", async () => {
    const origin = new Date("2026-08-11T12:00:00.000Z");
    let elapsedMs = 0;
    const client = new FetchMintQuoteClient({
      fetch: async (input) => {
        const quote = decodeURIComponent(input.toString().split("/").at(-1)!);
        return new Response(
          JSON.stringify({
            quote,
            request: `lnbc-${quote}`,
            state: "PAID",
          }),
        );
      },
      now: () => new Date(origin.getTime() + elapsedMs),
      timeoutMs: 1_000,
      rateLimit: {
        capacity: 1,
        refillPerMinute: 60,
        now: () => elapsedMs,
        wait: async (delayMs) => {
          elapsedMs += delayMs;
        },
      },
    });

    await client.checkQuote("https://mint.example.com", "quote-1");
    const result = await client.checkQuote(
      "https://mint.example.com",
      "quote-2",
    );

    expect(result).toMatchObject({
      kind: "found",
      requestStartedAt: new Date("2026-08-11T12:00:01.000Z"),
    });
  });

  test("uses the provided batch size and preserves quote order", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const client = new FetchMintQuoteClient({
      fetch: async (input, init) => {
        const url = input.toString();
        requests.push({ url, init });
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
      2,
    );

    expect(result.kind).toBe("found");
    if (result.kind === "found") {
      expect(result.checks.map(({ payload }) => payload.quote)).toEqual([
        "quote-1",
        "quote-2",
        "quote-3",
      ]);
    }
    expect(requests.map((request) => request.url)).toEqual([
      "https://mint.example.com/v1/mint/quote/bolt11/check",
      "https://mint.example.com/v1/mint/quote/bolt11/check",
    ]);
    expect(requests.map((request) => request.init?.method)).toEqual([
      "POST",
      "POST",
    ]);
    expect(requests.map((request) => request.init?.body)).toEqual([
      JSON.stringify({ quotes: ["quote-1", "quote-2"] }),
      JSON.stringify({ quotes: ["quote-3"] }),
    ]);
  });

  test("reports when each batched quote request actually starts", async () => {
    const origin = new Date("2026-08-11T12:00:00.000Z");
    let elapsedMs = 0;
    const client = new FetchMintQuoteClient({
      fetch: async (input, init) => {
        const body = JSON.parse(String(init?.body)) as { quotes: string[] };
        return new Response(
          JSON.stringify(
            body.quotes.map((quote) => ({
              quote,
              request: `lnbc-${quote}`,
              state: "PAID",
            })),
          ),
        );
      },
      now: () => new Date(origin.getTime() + elapsedMs),
      timeoutMs: 1_000,
      rateLimit: {
        capacity: 1,
        refillPerMinute: 60,
        now: () => elapsedMs,
        wait: async (delayMs) => {
          elapsedMs += delayMs;
        },
      },
    });

    const result = await client.checkQuotes(
      "https://mint.example.com",
      ["quote-1", "quote-2", "quote-3"],
      2,
    );

    expect(result.kind).toBe("found");
    if (result.kind === "found") {
      expect(
        result.checks.map(({ payload, requestStartedAt }) => ({
          quoteId: payload.quote,
          requestStartedAt,
        })),
      ).toEqual([
        {
          quoteId: "quote-1",
          requestStartedAt: new Date("2026-08-11T12:00:00.000Z"),
        },
        {
          quoteId: "quote-2",
          requestStartedAt: new Date("2026-08-11T12:00:00.000Z"),
        },
        {
          quoteId: "quote-3",
          requestStartedAt: new Date("2026-08-11T12:00:01.000Z"),
        },
      ]);
    }
  });

  test("rejects an invalid batch size before sending a request", async () => {
    let requests = 0;
    const client = new FetchMintQuoteClient({
      fetch: async () => {
        requests += 1;
        return new Response("[]");
      },
      rateLimit: { capacity: 100 },
    });

    expect(
      (await client.checkQuotes("https://mint.example.com", ["quote-1"], 1.5))
        .kind,
    ).toBe("invalid_response");
    expect(requests).toBe(0);
  });

  test("rejects a batch response that does not match request order", async () => {
    const responses = [
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
        await client.checkQuotes(
          "https://mint.example.com",
          ["quote-1", "quote-2"],
          2,
        )
      ).kind,
    ).toBe("invalid_response");
  });

  test("classifies quote responses without throwing", async () => {
    const requestStartedAt = new Date("2026-08-11T12:00:00.000Z");
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
      new Response(JSON.stringify({ detail: "Quote not found", code: 0 }), {
        status: 400,
      }),
      new Response("upstream failure", { status: 503 }),
      new Response(JSON.stringify({ state: "PAID" }), { status: 200 }),
    ];
    const client = new FetchMintQuoteClient({
      fetch: async () => responses.shift()!,
      now: () => requestStartedAt,
      timeoutMs: 1_000,
      rateLimit: { capacity: 100 },
    });

    expect(
      await client.checkQuote("https://mint.example.com/", "quote-1"),
    ).toEqual({
      kind: "found",
      payload: {
        quote: "quote-1",
        request: "lnbc1",
        state: "PAID",
        expiry: 1_786_000_000,
      },
      requestStartedAt,
    });
    expect(
      await client.checkQuote("https://mint.example.com", "missing"),
    ).toEqual({ kind: "not_found", requestStartedAt });
    expect(
      (await client.checkQuote("https://mint.example.com", "quote-1")).kind,
    ).toBe("mint_unavailable");
    expect(
      (await client.checkQuote("https://mint.example.com", "quote-1")).kind,
    ).toBe("invalid_response");
  });

  test("does not classify a bare 404 as quote not found", async () => {
    const client = new FetchMintQuoteClient({
      fetch: async () => new Response("Not Found", { status: 404 }),
      timeoutMs: 1_000,
      rateLimit: { capacity: 100 },
    });

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
          requestSignal?.addEventListener(
            "abort",
            () => reject(requestSignal?.reason),
            {
              once: true,
            },
          );
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
