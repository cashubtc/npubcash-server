import supertest from "supertest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import app from "../../app";
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
