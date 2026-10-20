import { Request, Response, NextFunction } from "express";
import { ApiError, LnurlError, PaymentRequiredError } from ".";
import {
  createCashuPaymentTerms,
  encodeCashuPaymentRequest,
} from "@/domain/payment/paymentRequest";
import { getRequestLogger } from "@/utils/logger";

function loggableError(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return error;
  }
  const details: {
    name: string;
    message: string;
    cause?: unknown;
  } = {
    name: error.name,
    message: error.message,
  };
  if ("cause" in error && error.cause !== undefined) {
    details.cause = loggableError(error.cause);
  }
  return details;
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(err);
  }
  const logger = getRequestLogger(req);

  if (err instanceof LnurlError) {
    if (err.statusCode >= 500) {
      logger.error("LNURL service unavailable", {
        cause: loggableError(err.cause),
      });
    }
    return res
      .status(err.statusCode)
      .json({ status: "ERROR", reason: err.reason });
  }

  logger.error(err);

  if (err instanceof PaymentRequiredError) {
    const paymentRequest = generatePaymentRequiredPayload(
      err.amount,
      err.mintUrl,
    );
    res.setHeader("X-Cashu", paymentRequest);
    res.setHeader("Access-Control-Expose-Headers", "X-Cashu");
    return res
      .status(err.statusCode)
      .json({ error: true, message: err.message });
  }

  if (err instanceof ApiError) {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    return res.status(statusCode).json({ error: true, message });
  }
  res.status(500).json({ error: true, message: "Internal Server Error" });
}

function generatePaymentRequiredPayload(amount: number, mintUrl: string) {
  return encodeCashuPaymentRequest(
    createCashuPaymentTerms(amount, [mintUrl]),
  );
}
