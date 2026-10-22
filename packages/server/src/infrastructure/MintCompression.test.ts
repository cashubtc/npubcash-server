import { describe, expect, test } from "bun:test";
import { strict as assert } from "node:assert";
import { promisify } from "node:util";
import {
  brotliCompressSync,
  brotliDecompress,
  brotliDecompressSync,
  constants,
  gzipSync,
} from "node:zlib";
import { FetchMintInfoLoader } from "./FetchMintInfoLoader";
import { createCashuMintRequest } from "./CashuMintRequest";
import { FetchMintQuoteClient } from "../domain/mintQuoteMonitor/MintQuoteClient";
import { MintService } from "../domain/mint/MintService";
import type { MintRequestExecutor } from "./MintRequestExecutor";

const executor: MintRequestExecutor = {
  run: async (_mint, _signal, request) => request(new AbortController().signal),
};

describe("mint response compression on the patched Bun runtime", () => {
  test("rejects the CVE-2026-111497 invalid block switch with the patched decoder error", async () => {
    // Public regression fixture from Bun/Node's test-zlib-invalid-input.js.
    const invalid = Buffer.from(
      "200010414141fcffff07002228f00b60f7f41f000000",
      "hex",
    );
    const expected = { code: "ERR__ERROR_FORMAT_BLOCK_SWITCH", errno: -17 };
    expect(constants.BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH).toBe(-17);
    assert.throws(() => brotliDecompressSync(invalid), expected);
    await assert.rejects(promisify(brotliDecompress)(invalid), expected);
  });

  for (const encoding of ["br", "gzip"] as const) {
    for (const redirect of [false, true]) {
      test(`all mint clients accept ${encoding} responses${redirect ? " after redirects" : ""}`, async () => {
        const payload = {
          nuts: {},
          quote: "quote-1",
          request: "lnbc1",
          state: "UNPAID",
        };
        const advertised: Array<string | null> = [];
        const server = Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          fetch(req) {
            advertised.push(req.headers.get("Accept-Encoding"));
            const body = JSON.stringify(req.method === "POST" ? [payload] : payload);
            const compressed = encoding === "br" ? brotliCompressSync(body) : gzipSync(body);
            return new Response(compressed, {
              status: redirect && new URL(req.url).pathname !== "/target" ? 307 : 200,
              headers: {
                Location: "/target",
                "Content-Encoding": encoding,
                "Content-Type": "application/json",
              },
            });
          },
        });
        try {
          const origin = `http://127.0.0.1:${server.port}`;
          const info = new FetchMintInfoLoader({ requestExecutor: executor });
          const cashu = createCashuMintRequest({ mintUrl: origin, requestExecutor: executor });
          const quotes = new FetchMintQuoteClient({ requestExecutor: executor });
          const service = new MintService({
            getMint: async () => null,
            saveMint: async () => {},
          });

          expect(await info.getMintInfo(origin)).toMatchObject({ nuts: {} });
          expect(await cashu({ endpoint: origin })).toMatchObject({ nuts: {} });
          expect(await quotes.checkQuote(origin, "quote-1")).toMatchObject({
            kind: "found", payload: { quote: "quote-1" },
          });
          expect(await quotes.checkQuotes(origin, ["quote-1"], 1)).toMatchObject({
            kind: "found", checks: [{ payload: { quote: "quote-1" } }],
          });
          await expect(service.checkMintUrl(origin, false)).resolves.toBeDefined();
          expect(advertised.length).toBeGreaterThanOrEqual(5);
          expect(advertised.every(value => value !== "identity")).toBe(true);
        } finally {
          server.stop(true);
        }
      });
    }
  }

  test("compressed HTTP errors retain mint failure handling", async () => {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () => new Response(
        brotliCompressSync(JSON.stringify({ error: "mint unavailable" })),
        { status: 503, headers: { "Content-Encoding": "br", "Content-Type": "application/json" } },
      ),
    });
    try {
      const origin = `http://127.0.0.1:${server.port}`;
      const info = new FetchMintInfoLoader({ requestExecutor: executor });
      const cashu = createCashuMintRequest({ mintUrl: origin, requestExecutor: executor });
      const quotes = new FetchMintQuoteClient({ requestExecutor: executor });
      await expect(info.getMintInfo(origin)).rejects.toThrow("HTTP 503");
      await expect(cashu({ endpoint: origin })).rejects.toThrow("mint unavailable");
      for (const result of [
        await quotes.checkQuote(origin, "quote-1"),
        await quotes.checkQuotes(origin, ["quote-1"], 1),
      ]) {
        expect(result.kind).toBe("mint_unavailable");
        expect((result as { cause: Error }).cause.message).toContain("mint unavailable");
      }
    } finally {
      server.stop(true);
    }
  });
});
