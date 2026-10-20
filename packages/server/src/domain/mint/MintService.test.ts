import { describe, expect, test } from "bun:test";
import type { GetInfoResponse } from "@cashu/cashu-ts";
import { Mint } from "./Mint";
import type { MintRepository } from "./MintRepository";
import { MintService } from "./MintService";

function createService(nut29?: Record<string, unknown>): MintService {
  const info = {
    name: "Test mint",
    pubkey: "02".padEnd(66, "0"),
    version: "test",
    contact: [],
    nuts: {
      4: { methods: [], disabled: false },
      5: { methods: [], disabled: false },
      ...(nut29 ? { 29: nut29 } : {}),
    },
  } as unknown as GetInfoResponse;
  const mint = new Mint({
    url: "https://mint.example.com",
    info,
    lastChecked: new Date(),
  });
  const repository: MintRepository = {
    getMint: async () => mint,
    saveMint: async () => undefined,
  };

  return new MintService(repository);
}

describe("MintService.supportsQuoteBatching", () => {
  test("reports no support when the mint does not advertise NUT-29", async () => {
    const service = createService();

    await expect(
      service.supportsQuoteBatching("https://mint.example.com"),
    ).resolves.toEqual({ support: false });
  });

  test("reports no support when NUT-29 does not advertise bolt11", async () => {
    const service = createService({ methods: ["bolt12"] });

    await expect(
      service.supportsQuoteBatching("https://mint.example.com"),
    ).resolves.toEqual({ support: false });
  });

  test("returns the advertised maximum batch size", async () => {
    const service = createService({
      max_batch_size: 42,
      methods: ["bolt11"],
    });

    await expect(
      service.supportsQuoteBatching("https://mint.example.com"),
    ).resolves.toEqual({ support: true, limit: 42 });
  });

  test("defaults the batch size to 100 when no limit is advertised", async () => {
    const service = createService({ methods: ["bolt11", "bolt12"] });

    await expect(
      service.supportsQuoteBatching("https://mint.example.com"),
    ).resolves.toEqual({ support: true, limit: 100 });
  });

  test("defaults the batch size when the advertised limit is invalid", async () => {
    const service = createService({
      max_batch_size: 2.5,
      methods: ["bolt11"],
    });

    await expect(
      service.supportsQuoteBatching("https://mint.example.com"),
    ).resolves.toEqual({ support: true, limit: 100 });
  });

  test("refreshes expired cached info through the injected loader", async () => {
    const staleMint = new Mint({
      url: "https://mint.example.com",
      info: {
        name: "Stale mint",
        pubkey: "02".padEnd(66, "0"),
        version: "test",
        contact: [],
        nuts: {
          4: { methods: [], disabled: false },
          5: { methods: [], disabled: false },
        },
      } as unknown as GetInfoResponse,
      lastChecked: new Date(0),
    });
    let savedMint: Mint | undefined;
    const controller = new AbortController();
    const loaderCalls: Array<{
      mintUrl: string;
      signal?: AbortSignal;
    }> = [];
    const service = new MintService(
      {
        getMint: async () => staleMint,
        saveMint: async (mint) => {
          savedMint = mint;
        },
      },
      {
        mintInfoLoader: {
          getMintInfo: async (mintUrl, signal) => {
            loaderCalls.push({ mintUrl, signal });
            return {
              ...staleMint.info,
              nuts: {
                ...staleMint.info.nuts,
                29: { methods: ["bolt11"], max_batch_size: 7 },
              },
            } as unknown as GetInfoResponse;
          },
        },
      },
    );

    await expect(
      service.supportsQuoteBatching(
        "https://mint.example.com",
        controller.signal,
      ),
    ).resolves.toEqual({ support: true, limit: 7 });
    expect(loaderCalls).toEqual([
      {
        mintUrl: "https://mint.example.com",
        signal: controller.signal,
      },
    ]);
    expect(savedMint).toBe(staleMint);
  });
});
