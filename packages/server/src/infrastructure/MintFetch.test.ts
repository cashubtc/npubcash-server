import { describe, expect, test } from "bun:test";
import { brotliCompressSync } from "node:zlib";
import { createMintFetch } from "./MintFetch";
import { FetchMintInfoLoader } from "./FetchMintInfoLoader";
import { createCashuMintRequest } from "./CashuMintRequest";
import { FetchMintQuoteClient } from "../domain/mintQuoteMonitor/MintQuoteClient";
import { MintService } from "../domain/mint/MintService";
import type { MintRequestExecutor } from "./MintRequestExecutor";

const executor: MintRequestExecutor = {
  run: async (_mint, _signal, request) => request(new AbortController().signal),
};

describe("mint response decompression mitigation", () => {
  test("forces identity and disables decoding while preserving request options", async () => {
    const signal = new AbortController().signal;
    const response = Response.json({ ok: true });
    const safeFetch = createMintFetch(async (_input, init) => {
      expect(init).toMatchObject({
        decompress: false,
        method: "POST",
        body: "{}",
        signal,
      });
      const headers = new Headers(init?.headers);
      expect(headers.get("Accept-Encoding")).toBe("identity");
      expect(headers.get("Authorization")).toBe("Bearer test");
      return response;
    });
    const init = {
      method: "POST",
      body: "{}",
      signal,
      decompress: true,
      headers: { "accept-encoding": "br", Authorization: "Bearer test" },
    };
    expect(await safeFetch("https://mint.example", init)).toBe(response);
    expect(init.headers["accept-encoding"]).toBe("br");
  });

  for (const encoding of [
    "br",
    "BR",
    "gzip",
    "deflate",
    "zstd",
    "gzip, br",
    "",
  ]) {
    test(`rejects and cancels encoded bodies without reading them: ${encoding}`, async () => {
      let cancelled = false;
      const body = new ReadableStream({
        cancel() {
          cancelled = true;
        },
      });
      const safeFetch = createMintFetch(
        async () =>
          new Response(body, {
            status: 503,
            headers: { "Content-Encoding": encoding },
          }),
      );
      await expect(safeFetch("https://mint.example")).rejects.toThrow(
        "Compressed mint responses",
      );
      expect(cancelled).toBe(true);
    });
  }

  test("preserves Request headers and accepts explicit identity responses", async () => {
    const safeFetch = createMintFetch(async (_input, init) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        "Bearer test",
      );
      return new Response("{}", {
        headers: { "Content-Encoding": "identity" },
      });
    });
    const response = await safeFetch(
      new Request("https://mint.example", {
        headers: { Authorization: "Bearer test", "Accept-Encoding": "br" },
      }),
    );
    expect(await response.json()).toEqual({});
  });

  test("all mint clients refuse unsolicited Brotli, including redirects and HTTP errors", async () => {
    const payload = {
      nuts: {},
      quote: "quote-1",
      request: "lnbc1",
      state: "UNPAID",
    };
    const compressed = brotliCompressSync(Buffer.from(JSON.stringify(payload)));
    let mode: "plain" | "br" | "redirect" | "error" = "plain";
    const advertised: Array<string | null> = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(req) {
        advertised.push(req.headers.get("Accept-Encoding"));
        if (mode === "redirect" && new URL(req.url).pathname !== "/target") {
          return new Response(compressed, {
            status: 307,
            headers: { Location: "/target", "Content-Encoding": "br" },
          });
        }
        if (mode !== "plain") {
          return new Response(compressed, {
            status: mode === "error" ? 503 : 200,
            headers: {
              "Content-Encoding": "br",
              "Content-Type": "application/json",
            },
          });
        }
        return Response.json(req.method === "POST" ? [payload] : payload);
      },
    });
    try {
      const origin = `http://127.0.0.1:${server.port}`;
      const info = new FetchMintInfoLoader({ requestExecutor: executor });
      const cashu = createCashuMintRequest({
        mintUrl: origin,
        requestExecutor: executor,
      });
      const quotes = new FetchMintQuoteClient({ requestExecutor: executor });
      const createService = () =>
        new MintService({
          getMint: async () => null,
          saveMint: async () => {},
        });

      // Verify the exact runtime honors the Bun-specific flag before relying on it.
      mode = "br";
      const raw = await fetch(origin, { decompress: false });
      expect(Buffer.from(await raw.arrayBuffer()).equals(compressed)).toBe(
        true,
      );
      advertised.length = 0;

      mode = "plain";
      expect(await info.getMintInfo(origin)).toMatchObject({ nuts: {} });
      expect(await cashu({ endpoint: origin })).toMatchObject({ nuts: {} });
      expect((await quotes.checkQuote(origin, "quote-1")).kind).toBe("found");
      expect((await quotes.checkQuotes(origin, ["quote-1"], 1)).kind).toBe(
        "found",
      );
      await expect(
        createService().checkMintUrl(origin, false),
      ).resolves.toBeDefined();

      for (const nextMode of ["br", "redirect", "error"] as const) {
        mode = nextMode;
        await expect(info.getMintInfo(origin)).rejects.toThrow(
          "Compressed mint responses",
        );
        await expect(cashu({ endpoint: origin })).rejects.toThrow(
          "Compressed mint responses",
        );
        for (const result of [
          await quotes.checkQuote(origin, "quote-1"),
          await quotes.checkQuotes(origin, ["quote-1"], 1),
        ]) {
          expect(result.kind).toBe("mint_unavailable");
          expect((result as { cause: Error }).cause.message).toContain(
            "Compressed mint responses",
          );
        }
        await expect(
          createService().checkMintUrl(origin, false),
        ).rejects.toThrow("Could not get mint info");
      }
      expect(advertised.length).toBeGreaterThan(0);
      expect(advertised.every((value) => value === "identity")).toBe(true);
    } finally {
      server.stop(true);
    }
  });
});
