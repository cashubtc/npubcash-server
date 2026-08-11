import { expect, test } from "bun:test";
import type { NextFunction, Request, Response } from "express";
import {
  InvalidRecipientError,
  LnurlServiceUnavailableError,
  RecipientUnavailableError,
} from ".";
import { errorHandler } from "./middleware";

function createResponseRecorder() {
  let statusCode: number | undefined;
  let payload: unknown;
  const response = {
    headersSent: false,
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    },
  } as unknown as Response;

  return {
    response,
    result: () => ({ statusCode, payload }),
  };
}

test("returns the LNURL unavailable response for an unavailable recipient", () => {
  const { response, result } = createResponseRecorder();
  const request = { reqId: "request-1" } as Request;
  const next = (() => {}) as NextFunction;

  errorHandler(new RecipientUnavailableError(), request, response, next);

  expect(result()).toEqual({
    statusCode: 200,
    payload: { status: "ERROR", reason: "Recipient unavailable." },
  });
});

test("returns the LNURL invalid-recipient response for malformed input", () => {
  const { response, result } = createResponseRecorder();

  errorHandler(
    new InvalidRecipientError(),
    { reqId: "request-2" } as Request,
    response,
    (() => {}) as NextFunction,
  );

  expect(result()).toEqual({
    statusCode: 200,
    payload: { status: "ERROR", reason: "Invalid recipient." },
  });
});

test("returns an LNURL service error without exposing its operational cause", () => {
  const { response, result } = createResponseRecorder();

  errorHandler(
    new LnurlServiceUnavailableError(new Error("database credentials")),
    { reqId: "request-3" } as Request,
    response,
    (() => {}) as NextFunction,
  );

  expect(result()).toEqual({
    statusCode: 500,
    payload: {
      status: "ERROR",
      reason: "Service temporarily unavailable.",
    },
  });
});
