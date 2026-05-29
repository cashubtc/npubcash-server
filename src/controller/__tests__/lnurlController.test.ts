import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { decodeAndValidateZapRequest } from "../../utils/nostr";
import app from "../../app";
import { Transaction, User } from "../../models";
import { createLnurlResponse } from "../../utils/lnurl";
import { wallet } from "../../config";

vi.mock("../../models/user.ts");
vi.mock("../../models/transaction.ts");

vi.mock("../../utils/nostr", () => ({
  decodeAndValidateZapRequest: vi.fn(),
}));

vi.mock("../../utils/lnurl", () => ({
  createLnurlResponse: vi.fn(),
}));

vi.mock("../utils/lnurl", async () => {
  return {
    createLnurlResponse: vi.fn(),
  };
});

vi.mock("crypto", () => ({
  createHash: () => ({
    update: () => ({
      digest: vi.fn().mockReturnValue("mockedHash"),
    }),
  }),
}));

vi.mock("../utils/lightning", () => ({
  parseInvoice: vi.fn(),
}));

vi.mock("nostr-tools", () => ({
  SimplePool: vi.fn(),
}));

vi.mock("../../config.ts", () => ({
  wallet: {
    createMintQuote: vi.fn(),
    createMintQuoteBolt11: vi.fn(),
  },
}));

const settlementServiceMock = vi.hoisted(() => ({
  startWatchingTransaction: vi.fn(),
}));

vi.mock("../../services/paymentSettlement", () => ({
  PaymentSettlementService: {
    getInstance: vi.fn(() => settlementServiceMock),
  },
}));

describe("lnurlController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    process.env.NODE_ENV = "development";
  });

  it("should return 401 for invalid npub", async () => {
    const res = await request(app).get("/.well-known/lnurlp/npubIsInvalid");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({});
  });

  it("should return 404 if user not found", async () => {
    vi.mocked(User.getUserByName).mockResolvedValue(undefined);

    const res = await request(app).get("/.well-known/lnurlp/nonexistentUser");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({});
  });

  it("should return lnurl response if no amount provided", async () => {
    vi.mocked(User.getUserByName, { partial: true }).mockResolvedValue({
      name: "testUser",
      mint_url: "https://mint.minibits.cash/Bitcoin",
      pubkey: "testPubkey...",
    });
    vi.mocked(createLnurlResponse).mockReturnValue({
      callback: "https://npub.cash/.well-known/lnurlp/testUser",
      minSendable: 1000,
      maxSendable: 100000,
      metadata: "",
      tag: "pay",
    });

    const res = await request(app).get("/.well-known/lnurlp/testUser");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      callback: "https://npub.cash/.well-known/lnurlp/testUser",
      minSendable: 1000,
      maxSendable: 100000,
      metadata: "",
      tag: "pay",
    });
  });

  it("should return error for invalid amount", async () => {
    vi.stubEnv("LNURL_MIN_AMOUNT", "10");
    vi.stubEnv("LNURL_MAX_AMOUNT", "1000");
    const res = await request(app).get("/.well-known/lnurlp/testUser?amount=5");

    expect(res.status).toBe(500);
  });

  it("should return error for invalid zap request", async () => {
    vi.mocked(decodeAndValidateZapRequest).mockImplementation(() => {
      throw new Error("Invalid zap request");
    });

    const res = await request(app).get(
      "/.well-known/lnurlp/testUser?amount=100&nostr=invalidZapRequest",
    );

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: true, message: "Invalid zap request" });
  });

  it("should return invoice for valid request without nostr", async () => {
    vi.mocked(User.getUserByName, { partial: true }).mockResolvedValue({
      name: "testUser",
      mint_url: "https://mint.minibits.cash/Bitcoin",
      pubkey: "testPubkey...",
    });
    const createMintQuoteMock = vi
      .mocked(wallet.createMintQuoteBolt11)
      .mockResolvedValue({
        quote: "quote-id",
        request: "invoice",
        amount: 21,
        state: "UNPAID",
        expiry: null,
        unit: "sat",
      });
    vi.mocked(Transaction.createTransaction, {
      partial: true,
    }).mockResolvedValue({
      mint_pr: "123",
      mint_hash: "456",
      server_pr: "invoice",
      server_hash: "hash",
      user: "testUser",
      zap_request: undefined,
      amount: 21,
      fulfilled: false,
    });
    vi.mocked(Transaction.createCashuTransaction, {
      partial: true,
    }).mockResolvedValue({
      id: 1,
      mint_pr: "invoice",
      mint_hash: "quote-id",
      server_pr: "invoice",
      server_hash: "quote-id",
      cashu_quote_id: "quote-id",
      user: "testUser",
      zap_request: undefined,
      amount: 21,
      fulfilled: false,
    });

    vi.stubEnv("LNURL_MIN_AMOUNT", "10");
    vi.stubEnv("LNURL_MAX_AMOUNT", "1000000");

    const res = await request(app).get(
      "/.well-known/lnurlp/testUser?amount=21000",
    );

    expect(createMintQuoteMock).toHaveBeenCalledWith(21, "Cashu Address");
    expect(Transaction.createCashuTransaction).toHaveBeenCalledWith(
      "quote-id",
      "invoice",
      "testUser",
      undefined,
      21,
    );
    expect(settlementServiceMock.startWatchingTransaction).toHaveBeenCalled();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ pr: "invoice", routes: [] });
  });

  it("should create zap invoices with the zap request description hash", async () => {
    const zapRequest = {
      id: "zap-id",
      pubkey: "zap-pubkey",
      created_at: 1,
      kind: 9734,
      tags: [],
      content: "",
      sig: "sig",
    };
    vi.mocked(User.getUserByName, { partial: true }).mockResolvedValue({
      name: "testUser",
      mint_url: "https://mint.minibits.cash/Bitcoin",
      pubkey: "testPubkey...",
    });
    vi.mocked(decodeAndValidateZapRequest).mockReturnValue(zapRequest);
    const createMintQuoteMock = vi
      .mocked(wallet.createMintQuote)
      .mockResolvedValue({
        quote: "quote-id",
        request: "invoice",
        amount: 21,
        state: "UNPAID",
        expiry: null,
        unit: "sat",
      });
    vi.mocked(Transaction.createCashuTransaction, {
      partial: true,
    }).mockResolvedValue({
      id: 1,
      mint_pr: "invoice",
      mint_hash: "quote-id",
      server_pr: "invoice",
      server_hash: "quote-id",
      cashu_quote_id: "quote-id",
      user: "testUser",
      zap_request: zapRequest,
      amount: 21,
      fulfilled: false,
    });

    vi.stubEnv("LNURL_MIN_AMOUNT", "10");
    vi.stubEnv("LNURL_MAX_AMOUNT", "1000000");

    const res = await request(app).get(
      "/.well-known/lnurlp/testUser?amount=21000&nostr=zapRequest",
    );

    expect(createMintQuoteMock).toHaveBeenCalledWith("bolt11", {
      amount: 21,
      description_hash: "mockedHash",
    });
    expect(wallet.createMintQuoteBolt11).not.toHaveBeenCalled();
    expect(Transaction.createCashuTransaction).toHaveBeenCalledWith(
      "quote-id",
      "invoice",
      "testUser",
      zapRequest,
      21,
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ pr: "invoice", routes: [] });
  });
});
