import supertest from "supertest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import app from "../../app";
import { wallet } from "../../config";
import { User } from "../../models";

const pubkey =
  "ca9881c70e72981b356353453f4bbfd8153d209acd9b7b5b4200e80c7dec8c7a";
const npub = "npub1e2vgr3cww2vpkdtr2dzn7jalmq2n6gy6ekdhkk6zqr5qcl0v33aqa87qqk";

const mockAuthMiddleware = vi.hoisted(() =>
  vi.fn((req, res, next) => {
    req.authData = {
      authorized: true,
      data: { pubkey, npub },
    };
    next();
  }),
);

vi.mock("../../middleware/auth.ts", () => ({
  isAuthMiddleware: (path, method) => {
    return mockAuthMiddleware;
  },
}));

vi.mock("../../models/user.ts");

vi.mock("../../config.ts", () => ({
  wallet: {
    createMintQuoteBolt11: vi.fn(),
  },
}));

const settlementServiceMock = vi.hoisted(() => ({
  settleServiceRevenueQuote: vi.fn(),
}));

vi.mock("../../services/paymentSettlement", () => ({
  PaymentSettlementService: {
    getInstance: vi.fn(() => settlementServiceMock),
  },
}));

describe("PUT username", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("should return 400 if username is missing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await supertest(app)
      .put("/api/v1/info/username")
      .set("authorization", "validHeader");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: true, message: "Missing parameters" });
  });
  test("should return 400 if username starts with npub", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await supertest(app)
      .put("/api/v1/info/username")
      .send({ username: "npub1234" })
      .set("authorization", "validHeader");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: true, message: "Invalid username" });
  });
  test("should return 400 is username is already taken", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(User.checkIfUsernameExists).mockResolvedValueOnce(true);
    const res = await supertest(app)
      .put("/api/v1/info/username")
      .send({ username: "testUser" })
      .set("authorization", "validHeader");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: true,
      message: "This username is already taken",
    });
  });

  test("should return 400 is username is already set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(User.getUserByPubkey, { partial: true }).mockResolvedValueOnce({
      pubkey: pubkey,
      name: "username",
    });
    const res = await supertest(app)
      .put("/api/v1/info/username")
      .send({ username: "testUser" })
      .set("authorization", "validHeader");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: true,
      message: "Username already set",
    });
  });

  test("should return payment token and Cashu invoice on first request", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_SECRET", "secret");
    vi.mocked(wallet.createMintQuoteBolt11).mockResolvedValueOnce({
      quote: "quote-id",
      request: "invoice",
      amount: 10,
      state: "UNPAID",
      expiry: null,
      unit: "sat",
    });

    const res = await supertest(app)
      .put("/api/v1/info/username")
      .send({ username: "testUser" })
      .set("authorization", "validHeader");

    expect(res.status).toBe(402);
    expect(wallet.createMintQuoteBolt11).toHaveBeenCalledWith(
      10,
      "Username fee",
    );
    expect(res.body.data.paymentRequest).toBe("invoice");
    expect(res.body.data.paymentToken).toEqual(expect.any(String));
  });

  test("should charge a premium fee for satoshi", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_SECRET", "secret");
    vi.mocked(wallet.createMintQuoteBolt11).mockResolvedValueOnce({
      quote: "quote-id",
      request: "invoice",
      amount: 1000000,
      state: "UNPAID",
      expiry: null,
      unit: "sat",
    });

    const res = await supertest(app)
      .put("/api/v1/info/username")
      .send({ username: "satoshi" })
      .set("authorization", "validHeader");

    expect(res.status).toBe(402);
    expect(wallet.createMintQuoteBolt11).toHaveBeenCalledWith(
      1000000,
      "Username fee",
    );
    expect(res.body.data.paymentRequest).toBe("invoice");
    expect(res.body.data.paymentToken).toEqual(expect.any(String));
  });

  test("should assign username after paid quote", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_SECRET", "secret");
    vi.mocked(wallet.createMintQuoteBolt11).mockResolvedValueOnce({
      quote: "quote-id",
      request: "invoice",
      amount: 10,
      state: "UNPAID",
      expiry: null,
      unit: "sat",
    });
    const first = await supertest(app)
      .put("/api/v1/info/username")
      .send({ username: "testUser" })
      .set("authorization", "validHeader");

    settlementServiceMock.settleServiceRevenueQuote.mockResolvedValueOnce(true);
    vi.mocked(User.upsertUsernameByPubkey).mockResolvedValueOnce();

    const res = await supertest(app)
      .put("/api/v1/info/username")
      .send({
        username: "testUser",
        paymentToken: first.body.data.paymentToken,
      })
      .set("authorization", "validHeader");

    expect(res.status).toBe(200);
    expect(settlementServiceMock.settleServiceRevenueQuote).toHaveBeenCalled();
    expect(User.upsertUsernameByPubkey).toHaveBeenCalledWith(
      pubkey,
      "testuser",
    );
  });

  test("should keep username payment required while quote is unpaid", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_SECRET", "secret");
    vi.mocked(wallet.createMintQuoteBolt11).mockResolvedValueOnce({
      quote: "quote-id",
      request: "invoice",
      amount: 10,
      state: "UNPAID",
      expiry: null,
      unit: "sat",
    });
    const first = await supertest(app)
      .put("/api/v1/info/username")
      .send({ username: "testUser" })
      .set("authorization", "validHeader");

    settlementServiceMock.settleServiceRevenueQuote.mockResolvedValueOnce(
      false,
    );

    const res = await supertest(app)
      .put("/api/v1/info/username")
      .send({
        username: "testUser",
        paymentToken: first.body.data.paymentToken,
      })
      .set("authorization", "validHeader");

    expect(res.status).toBe(402);
    expect(res.body).toEqual({ error: true, message: "Invoice unpaid..." });
  });
});

describe("GET /info ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("should return default info, when user is not set", async () => {
    vi.stubEnv("MINTURL", "url");
    const res = await supertest(app)
      .get("/api/v1/info")
      .set("authorization", "validHeader");
    expect(mockAuthMiddleware).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ username: null, npub, mintUrl: "url" });
  });
});

describe("PUT /info/mint", () => {
  test("should return 400 if URL is missing", async () => {
    const res = await supertest(app)
      .put("/api/v1/info/mint")
      .set("authorization", "validHeader");
    expect(res.status).toBe(400);
    // expect(res.body).toEqual({ error: true, message: "Missing parameters" });
  });
  test("should return 400 if URL is invalid", async () => {
    const res = await supertest(app)
      .put("/api/v1/info/mint")
      .set("authorization", "validHeader")
      .send({ mintUrl: "invalid url" });
    expect(res.status).toBe(400);
    // expect(res.body).toEqual({ error: true, message: "Invalid URL" });
  });

  test("should return 500 if db failed", async () => {
    vi.mocked(User.upsertMintByPubkey).mockRejectedValueOnce("error");
    const res = await supertest(app)
      .put("/api/v1/info/mint")
      .set("authorization", "validHeader")
      .send({ mintUrl: "https://validurl.com" });
    expect(res.status).toBe(500);
    // expect(res.body).toEqual({ error: true, message: "Invalid URL" });
  });
  test("should return 204 if successfull", async () => {
    vi.mocked(User.upsertMintByPubkey).mockResolvedValueOnce();
    const res = await supertest(app)
      .put("/api/v1/info/mint")
      .set("authorization", "validHeader")
      .send({ mintUrl: "https://validurl.com" });
    expect(res.status).toBe(204);
    // expect(res.body).toEqual({ error: true, message: "Invalid URL" });
  });
});
