import { afterEach, describe, expect, mock, test } from "bun:test";
import { PaymentRequiredError } from "@/errors";
import type { NextFunction, Request, Response } from "express";

const mintUrl = "https://mint.example.com";
const createdUser = { pubkey: "pubkey", username: "alice" };
const decodedToken = { mint: mintUrl, proofs: [{ amount: 1000 }] };
const redeemedProofs = [{ amount: 1000 }];

const usernameConfig = {
  enabled: true,
  mintUrl,
  amount: 0,
};

const validateAndParseUsername = mock((username: string) => username);
const usernameExists = mock(async (_username: string) => false);
const setUsername = mock(async (_pubkey: string, _username: string) =>
  createdUser,
);
const getDecodedToken = mock((_token: string) => decodedToken);
const redeemToken = mock(async (_token: typeof decodedToken) => redeemedProofs);
const saveProofs = mock(async (_proofs: typeof redeemedProofs) => {});

mock.module("@/config", () => ({
  communicatorService: { redeemToken },
  proofService: { saveProofs },
  userService: {
    setUsername,
    usernameExists,
    validateAndParseUsername,
  },
}));

mock.module("../config/index", () => ({
  config: { usernameConfig },
}));

mock.module("@cashu/cashu-ts", () => ({ getDecodedToken }));

const { usernameController } = await import("./username");

afterEach(() => {
  usernameConfig.amount = 0;
  mock.clearAllMocks();
});

describe("usernameController", () => {
  test("creates a free username without checking for payment", async () => {
    const { req, header } = createRequest();
    const { res, status, json } = createResponse();
    const next = mock((_error?: unknown) => {});

    await usernameController(req, res, next as NextFunction);

    expect(header).not.toHaveBeenCalled();
    expect(getDecodedToken).not.toHaveBeenCalled();
    expect(redeemToken).not.toHaveBeenCalled();
    expect(saveProofs).not.toHaveBeenCalled();
    expect(setUsername).toHaveBeenCalledWith("pubkey", "alice");
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({
      error: false,
      data: { user: createdUser },
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
    expect(setUsername).not.toHaveBeenCalled();
  });

  test("redeems and saves a valid payment before creating a username", async () => {
    usernameConfig.amount = 1000;
    const { req } = createRequest("token");
    const { res, status } = createResponse();
    const next = mock((_error?: unknown) => {});

    await usernameController(req, res, next as NextFunction);

    expect(getDecodedToken).toHaveBeenCalledWith("token");
    expect(redeemToken).toHaveBeenCalledWith(decodedToken);
    expect(saveProofs).toHaveBeenCalledWith(redeemedProofs);
    expect(setUsername).toHaveBeenCalledWith("pubkey", "alice");
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
