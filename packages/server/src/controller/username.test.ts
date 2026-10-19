import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { PaymentRequiredError } from "@/errors";
import type { NextFunction, Request, Response } from "express";
import { getEncodedToken, type Token } from "@cashu/cashu-ts";

process.env.MINTURL ??= "https://mint.example.com";
process.env.JWT_SECRET ??= "test-jwt-secret";

const { SqliteAdapter } = await import("@/database/sqliteAdapter");
const { runMigrations } = await import("@/migrations");
const { createRepositories } =
  await import("@/infrastructure/db/repositoryFactory");
const { initializeAppServices } = await import("@/config");
const { config } = await import("@/config/index");
const { usernameController } = await import("./username");

const mintUrl = "https://mint.example.com";
const usernameConfig = { enabled: true, mintUrl, amount: 0 };
const decodedToken: Token = {
  mint: mintUrl,
  unit: "sat",
  proofs: [
    {
      amount: 1000,
      id: "00".repeat(8),
      secret: "test-payment",
      C: "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    },
  ],
};
const encodedToken = getEncodedToken(decodedToken);
const redeemedProofs = decodedToken.proofs;
let adapter: InstanceType<typeof SqliteAdapter>;
let services: Awaited<ReturnType<typeof initializeAppServices>>;
let originalUsernameConfig: typeof config.usernameConfig;

beforeEach(async () => {
  originalUsernameConfig = config.usernameConfig;
  usernameConfig.amount = 0;
  Object.assign(config, { usernameConfig });
  adapter = new SqliteAdapter(":memory:");
  await runMigrations(adapter);
  services = await initializeAppServices(
    createRepositories(adapter, { mintUrl }),
  );
  spyOn(services.userService, "setUsername");
  spyOn(services.communicatorService, "redeemToken").mockResolvedValue(
    redeemedProofs,
  );
  spyOn(services.proofService, "saveProofs");
});

afterEach(async () => {
  mock.restore();
  Object.assign(config, { usernameConfig: originalUsernameConfig });
  await adapter.close();
});

describe("usernameController", () => {
  test("creates a free username without checking for payment", async () => {
    const { req, header } = createRequest();
    const { res, status, json } = createResponse();
    const next = mock((_error?: unknown) => {});

    await usernameController(req, res, next as NextFunction);

    expect(header).not.toHaveBeenCalled();
    expect(services.communicatorService.redeemToken).not.toHaveBeenCalled();
    expect(services.proofService.saveProofs).not.toHaveBeenCalled();
    expect(services.userService.setUsername).toHaveBeenCalledWith(
      "pubkey",
      "alice",
    );
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({
      error: false,
      data: {
        user: expect.objectContaining({ pubkey: "pubkey", name: "alice" }),
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("requires payment for a positive username cost", async () => {
    usernameConfig.amount = 1000;
    const { req, header } = createRequest();
    const { res } = createResponse();
    const next = mock((_error?: unknown) => {});

    await usernameController(req, res, next as NextFunction);

    expect(header).toHaveBeenCalledWith("X-Cashu");
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(PaymentRequiredError);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ amount: 1000, mintUrl });
    expect(services.userService.setUsername).not.toHaveBeenCalled();
  });

  test("redeems and saves a valid payment before creating a username", async () => {
    usernameConfig.amount = 1000;
    const { req } = createRequest(encodedToken);
    const { res, status } = createResponse();
    const next = mock((_error?: unknown) => {});

    await usernameController(req, res, next as NextFunction);

    expect(services.communicatorService.redeemToken).toHaveBeenCalledWith(
      expect.objectContaining(decodedToken),
    );
    expect(services.proofService.saveProofs).toHaveBeenCalledWith(
      redeemedProofs,
    );
    expect(services.userService.setUsername).toHaveBeenCalledWith(
      "pubkey",
      "alice",
    );
    expect(status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });
});

function createRequest(xCashu?: string) {
  const header = mock((_name: string) => xCashu);
  const req = {
    authData: { data: { pubkey: "pubkey" } },
    body: { username: "alice" },
    header,
  } as unknown as Request<unknown, unknown, { username: string }>;

  return { req, header };
}

function createResponse() {
  const res = {} as Response;
  const status = mock((_status: number) => res);
  const json = mock((_body: unknown) => res);
  Object.assign(res, { json, status });

  return { res, status, json };
}
