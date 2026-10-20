import { beforeEach, describe, expect, test } from "bun:test";
import {
  deriveKeysetId,
  getDecodedToken,
  getEncodedToken,
  getEncodedTokenV4,
  type Token,
} from "@cashu/cashu-ts";
import type { MintRequestBudget } from "@/infrastructure/MintRequestBudget";
import { BudgetedMintRequestExecutor } from "@/infrastructure/MintRequestExecutor";
import { createCashuWalletFactory } from "./CashuWalletFactory";
import {
  CommunicatorService,
  type CommunicatorWalletFactory,
} from "./CommunicatorService";

interface RecordedRequest {
  url: string;
  init: RequestInit | undefined;
}

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

const mintKeys = {
  1: "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
};
const keysetId = deriveKeysetId(mintKeys);

describe("CommunicatorService", () => {
  let requests: RecordedRequest[];
  let budget: RecordingBudget;
  let walletCreations: number;
  let service: CommunicatorService;

  beforeEach(() => {
    requests = [];
    budget = new RecordingBudget();
    walletCreations = 0;
    const requestExecutor = new BudgetedMintRequestExecutor({
      requestBudget: budget,
      timeoutMs: 1_000,
    });
    const createWallet = createCashuWalletFactory({
      requestExecutor,
      fetch: async (input, init) => {
        const url = input.toString();
        requests.push({ url, init });
        return mintResponse(url, init);
      },
    });
    const walletFactory: CommunicatorWalletFactory = (mintUrl) => {
      walletCreations += 1;
      return createWallet(mintUrl);
    };
    service = new CommunicatorService({ walletFactory });
  });

  test("budgets the mint requests needed for an ordinary mint quote", async () => {
    await expect(
      service.createMintQuote(
        21,
        { pubkey: "11".repeat(32), lockQuote: false },
        "HTTPS://MINT.EXAMPLE.COM/",
      ),
    ).resolves.toMatchObject({
      locked: false,
      quote: "quote-id",
      request: "lnbc1invoice",
    });

    expect(budget.mintUrls).toEqual([
      "https://mint.example.com",
      "https://mint.example.com",
      "https://mint.example.com",
      "https://mint.example.com",
    ]);
    expect(requestedUrls(requests)).toEqual([
      "https://mint.example.com/v1/info",
      "https://mint.example.com/v1/keysets",
      "https://mint.example.com/v1/keys",
      "https://mint.example.com/v1/mint/quote/bolt11",
    ]);
    expect(quoteRequestBodies(requests)).toEqual([
      { unit: "sat", amount: 21 },
    ]);
  });

  test("budgets the mint requests needed for a locked mint quote", async () => {
    const nostrPublicKey = "22".repeat(32);

    await expect(
      service.createMintQuote(
        34,
        { pubkey: nostrPublicKey, lockQuote: true },
        "HTTPS://MINT.EXAMPLE.COM/",
      ),
    ).resolves.toMatchObject({
      locked: true,
      quote: "locked-quote-id",
      request: "lnbc1locked",
    });

    expect(requestedUrls(requests)).toEqual([
      "https://mint.example.com/v1/info",
      "https://mint.example.com/v1/keysets",
      "https://mint.example.com/v1/keys",
      "https://mint.example.com/v1/mint/quote/bolt11",
    ]);
    expect(quoteRequestBodies(requests)).toEqual([
      {
        unit: "sat",
        amount: 34,
        pubkey: `02${nostrPublicKey}`,
      },
    ]);
  });

  test("loads keyset keys before redeeming a V4 token", async () => {
    const token = {
      mint: "https://token-mint.example.com",
      unit: "sat",
      proofs: [
        {
          id: keysetId,
          amount: 1,
          secret: "00".repeat(32),
          C: mintKeys[1],
        },
      ],
    } as Token;

    await expect(service.redeemToken(token)).resolves.toHaveLength(1);

    expect(requestedUrls(requests)).toEqual([
      "https://token-mint.example.com/v1/info",
      "https://token-mint.example.com/v1/keysets",
      "https://token-mint.example.com/v1/keys",
      "https://token-mint.example.com/v1/swap",
    ]);
  });

  test("shares one wallet, keyset cache, and budget lane across equivalent mint URLs", async () => {
    await service.createMintQuote(
      5,
      { pubkey: "33".repeat(32), lockQuote: false },
      "HTTPS://MINT.EXAMPLE.COM/",
    );
    await service.createMintQuote(
      8,
      { pubkey: "33".repeat(32), lockQuote: false },
      "https://mint.example.com",
    );

    expect(walletCreations).toBe(1);
    expect(budget.mintUrls).toHaveLength(5);
    expect(quoteRequestBodies(requests)).toEqual([
      { unit: "sat", amount: 5 },
      { unit: "sat", amount: 8 },
    ]);
  });

  test("propagates failures from cashu-ts", async () => {
    await expect(
      service.createMintQuote(
        999,
        { pubkey: "44".repeat(32), lockQuote: false },
        "https://mint.example.com",
      ),
    ).rejects.toThrow("mint quote failed");
  });
});

describe("cashu-ts token decoding", () => {
  const shortKeysetId = "0100aabbccddeeff0011223344556677";
  const token = {
    mint: "https://mint.example.com",
    unit: "sat",
    proofs: [
      {
        id: shortKeysetId,
        amount: 1,
        secret: "00".repeat(32),
        C: mintKeys[1],
      },
    ],
  } as Token;

  test("decodes V3 and V4 tokens when the mint keyset ids are known", () => {
    const v3 = getEncodedToken(token, { version: 3 });
    const v4 = getEncodedTokenV4(token);

    expect(getDecodedToken(v3, [shortKeysetId]).proofs[0]?.id).toBe(
      shortKeysetId,
    );
    const decodedV4 = getDecodedToken(v4, [shortKeysetId]);
    expect(decodedV4.proofs[0]?.id).toBe(shortKeysetId);
    expect(decodedV4.proofs[0]?.amount).toBe(1);
    expect(decodedV4.unit).toBe("sat");
  });

  test("rejects V4 tokens without mint keyset ids", () => {
    expect(() => getDecodedToken(getEncodedTokenV4(token))).toThrow();
  });
});

function requestedUrls(recorded: RecordedRequest[]): string[] {
  return recorded.map(({ url }) => url);
}

function quoteRequestBodies(recorded: RecordedRequest[]): unknown[] {
  return recorded
    .filter(({ url }) => url.endsWith("/v1/mint/quote/bolt11"))
    .map(({ init }) => JSON.parse(String(init?.body)));
}

function mintResponse(url: string, init?: RequestInit): Response {
  if (url.endsWith("/v1/info")) {
    return Response.json({
      name: "Test mint",
      pubkey: mintKeys[1],
      version: "test/1.0",
      nuts: { 20: { supported: true } },
    });
  }
  if (url.endsWith("/v1/keysets")) {
    return Response.json({
      keysets: [
        { id: keysetId, unit: "sat", active: true, input_fee_ppk: 0 },
      ],
    });
  }
  if (url.endsWith("/v1/keys")) {
    return Response.json({
      keysets: [{ id: keysetId, unit: "sat", keys: mintKeys }],
    });
  }
  if (url.endsWith("/v1/swap")) {
    return Response.json({
      signatures: [{ id: keysetId, amount: 1, C_: mintKeys[1] }],
    });
  }
  if (url.endsWith("/v1/mint/quote/bolt11")) {
    const body = JSON.parse(String(init?.body)) as {
      amount: number;
      pubkey?: string;
    };
    if (body.amount === 999) {
      return Response.json({ error: "mint quote failed" }, { status: 500 });
    }
    return Response.json({
      quote: body.pubkey ? "locked-quote-id" : "quote-id",
      request: body.pubkey ? "lnbc1locked" : "lnbc1invoice",
      state: "UNPAID",
      expiry: 1_800_000_000,
      amount: body.amount,
      unit: "sat",
      ...(body.pubkey ? { pubkey: body.pubkey } : {}),
    });
  }
  return Response.json({ error: "unexpected request" }, { status: 500 });
}
