import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Token } from "@cashu/cashu-ts";
import type { MintRequestBudget } from "@/infrastructure/MintRequestBudget";

interface RecordedWallet {
  mintUrl: string;
  quoteAmounts: number[];
  lockedQuotes: Array<{ amount: number; publicKey: string }>;
  receivedTokens: Token[];
}

const wallets: RecordedWallet[] = [];

mock.module("@cashu/cashu-ts", () => ({
  CashuMint: class CashuMint {
    constructor(readonly mintUrl: string) {}
  },
  CashuWallet: class CashuWallet {
    private readonly record: RecordedWallet;

    constructor(mint: { mintUrl: string }) {
      this.record = {
        mintUrl: mint.mintUrl,
        quoteAmounts: [],
        lockedQuotes: [],
        receivedTokens: [],
      };
      wallets.push(this.record);
    }

    async createMintQuote(amount: number) {
      if (amount === 999) throw new Error("mint quote failed");
      this.record.quoteAmounts.push(amount);
      return { quote: "quote-id", request: "lnbc1invoice" };
    }

    async createLockedMintQuote(amount: number, publicKey: string) {
      this.record.lockedQuotes.push({ amount, publicKey });
      return { quote: "locked-quote-id", request: "lnbc1locked" };
    }

    async receive(token: Token) {
      this.record.receivedTokens.push(token);
      return [{ amount: 8, id: "keyset-id", secret: "secret", C: "C" }];
    }
  },
}));

const { CommunicatorService } = await import("./CommunicatorService");

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

describe("CommunicatorService", () => {
  beforeEach(() => {
    wallets.length = 0;
  });

  test("creates ordinary mint quotes through the shared request budget", async () => {
    const budget = new RecordingBudget();
    const service = new CommunicatorService({ requestBudget: budget });

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
    expect(budget.mintUrls).toEqual(["https://mint.example.com"]);
    expect(wallets).toEqual([
      {
        mintUrl: "https://mint.example.com",
        quoteAmounts: [21],
        lockedQuotes: [],
        receivedTokens: [],
      },
    ]);
  });

  test("creates locked mint quotes with a compressed Nostr public key", async () => {
    const budget = new RecordingBudget();
    const service = new CommunicatorService({ requestBudget: budget });
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
    expect(budget.mintUrls).toEqual(["https://mint.example.com"]);
    expect(wallets[0]?.lockedQuotes).toEqual([
      { amount: 34, publicKey: `02${nostrPublicKey}` },
    ]);
  });

  test("redeems a token through its mint's shared request budget", async () => {
    const budget = new RecordingBudget();
    const service = new CommunicatorService({ requestBudget: budget });
    const token = {
      mint: "HTTPS://TOKEN-MINT.EXAMPLE.COM/",
      proofs: [],
    } as Token;

    await expect(service.redeemToken(token)).resolves.toEqual([
      { amount: 8, id: "keyset-id", secret: "secret", C: "C" },
    ]);
    expect(budget.mintUrls).toEqual(["https://token-mint.example.com"]);
    expect(wallets).toEqual([
      {
        mintUrl: "https://token-mint.example.com",
        quoteAmounts: [],
        lockedQuotes: [],
        receivedTokens: [token],
      },
    ]);
  });

  test("shares one wallet and budget lane across equivalent mint URLs", async () => {
    const budget = new RecordingBudget();
    const service = new CommunicatorService({ requestBudget: budget });

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

    expect(budget.mintUrls).toEqual([
      "https://mint.example.com",
      "https://mint.example.com",
    ]);
    expect(wallets).toHaveLength(1);
    expect(wallets[0]?.quoteAmounts).toEqual([5, 8]);
  });

  test("propagates failures from cashu-ts", async () => {
    const service = new CommunicatorService({
      requestBudget: new RecordingBudget(),
    });

    await expect(
      service.createMintQuote(
        999,
        { pubkey: "44".repeat(32), lockQuote: false },
        "https://mint.example.com",
      ),
    ).rejects.toThrow("mint quote failed");
  });
});
