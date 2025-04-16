import { describe, expect, test, vi } from "vitest";
import { NextFunction, Request, Response } from "express";
import { isAuthMiddleware } from "../auth";
import { finalizeEvent, generateSecretKey } from "nostr-tools";

const headerFunc = vi.fn();
const resStatus = vi.fn();

const sk = generateSecretKey();

const validAuthEvent = {
  content: "",
  kind: 27235,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ["u", "https://test.com/test"],
    ["method", "GET"],
  ],
};

describe("Auth Middleware", () => {
  test("pass valid requests on", async () => {
    vi.mocked(headerFunc).mockImplementation((header: string) => {
      if (header === "host") {
        return "test.com";
      }
      if (header === "X-Forwarded-Proto") {
        return "https";
      }
      if (header === "Authorization") {
        const signed = finalizeEvent(validAuthEvent, sk);
        const authHeader = `Nostr ${btoa(JSON.stringify(signed))}`;
        console.log(authHeader);
        return authHeader;
      }
    });
    const req = {
      header: headerFunc,
      get: () => "something",
    } as unknown as Request;
    const res = { status: resStatus } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;
    const middleware = isAuthMiddleware("/test", "GET");
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
  test("should return 400 on missing host header", async () => {
    vi.mocked(headerFunc).mockImplementation((header: string) => {
      if (header === "host") {
        return null;
      }
      if (header === "X-Forwarded-Proto") {
        return "https";
      }
      if (header === "Authorization") {
        const signed = finalizeEvent(validAuthEvent, sk);
        const authHeader = `Nostr ${btoa(JSON.stringify(signed))}`;
        console.log(authHeader);
        return authHeader;
      }
    });
    const req = {
      header: headerFunc,
      get: () => "something",
    } as unknown as Request;
    const res = { status: resStatus } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;
    const middleware = isAuthMiddleware("/test", "GET");
    await middleware(req, res, next);

    expect(resStatus).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(new Error("Missing headers"));
  });
  test("should return 400 on missing host header", async () => {
    vi.mocked(headerFunc).mockImplementation((header: string) => {
      if (header === "host") {
        return "test.com";
      }
      if (header === "X-Forwarded-Proto") {
        return "https";
      }
      if (header === "Authorization") {
        return null;
      }
    });
    const req = {
      header: headerFunc,
      get: () => "something",
    } as unknown as Request;
    const res = { status: resStatus } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;
    const middleware = isAuthMiddleware("/test", "GET");
    await middleware(req, res, next);

    expect(resStatus).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(
      new Error("Missing Authorization Header"),
    );
  });
  test("should return 400 on missing host header", async () => {
    vi.mocked(headerFunc).mockImplementation((header: string) => {
      if (header === "host") {
        return "test.de";
      }
      if (header === "X-Forwarded-Proto") {
        return "https";
      }
      if (header === "Authorization") {
        return "invalid";
      }
    });
    const req = {
      header: headerFunc,
      get: () => "something",
    } as unknown as Request;
    const res = { status: resStatus } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;
    const middleware = isAuthMiddleware("/test", "GET");
    await middleware(req, res, next);

    expect(resStatus).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(
      new Error("Invalid Authorization Header"),
    );
  });
});
