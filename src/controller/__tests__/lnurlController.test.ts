import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { decodeAndValidateZapRequest } from "../../utils/nostr";
import app from "../../app";
import { Transaction, User } from "../../models";
import { createLnurlResponse } from "../../utils/lnurl";
import { lnProvider, wallet } from "../../config";

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
    requestMint: vi.fn(),
  },
  lnProvider: {
    createInvoice: vi.fn(),
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
    vi.mocked(wallet.requestMint).mockResolvedValue({
      pr: "lnbc15u1p3xnhl2pp5jptserfk3zk4qy42tlucycrfwxhydvlemu9pqr93tuzlv9cc7g3sdqsvfhkcap3xyhx7un8cqzpgxqzjcsp5f8c52y2stc300gl6s4xswtjpc37hrnnr3c9wvtgjfuvqmpm35evq9qyyssqy4lgd8tj637qcjp05rdpxxykjenthxftej7a2zzmwrmrl70fyj9hvj0rewhzj7jfyuwkwcg9g2jpwtk3wkjtwnkdks84hsnu8xps5vsq4gj5hs",
      hash: "456",
    });
    const lnProviderMock = vi
      .mocked(lnProvider.createInvoice, { partial: true })
      .mockResolvedValue({
        paymentRequest: "invoice",
        paymentHash: "hash",
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

    vi.stubEnv("LNURL_MIN_AMOUNT", "10");
    vi.stubEnv("LNURL_MAX_AMOUNT", "1000000");

    const res = await request(app).get(
      "/.well-known/lnurlp/testUser?amount=21000",
    );

    expect(lnProviderMock).toHaveBeenCalledWith(
      1500,
      "Cashu Address",
      undefined,
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ pr: "invoice", routes: [] });
  });
});
