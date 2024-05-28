import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { decodeAndValidateZapRequest } from "../../utils/nostr";
import app from "../../app";
import { User } from "../../models";
import { createLnurlResponse } from "../../utils/lnurl";

vi.mock("../../models/user.ts");

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
}));

describe("lnurlController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(User.getUserByName).mockResolvedValue({
      name: "testUser",
      mint_url: "https://mint.minibits.cash/Bitcoin",
      pubkey: "testPubkey...",
      upsertMintByPubkey: async (mint: string) => {},
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
    process.env.LNURL_MAX_AMOUNT = "1000";
    process.env.LNURL_MIN_AMOUNT = "10";

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

  // Add more tests to cover all scenarios
});
