import { Request, Response, NextFunction } from "express";
import { ApiError, PaymentRequiredError } from ".";
import { encodeCBOR } from "@/utils/cbor";

export function errorHandler(
  err: any,
  _: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(err);
  }
  console.error("Error:", err);

  if (err instanceof PaymentRequiredError) {
    const paymentRequest = generatePaymentRequiredPayload(
      err.amount,
      err.mintUrl,
    );
    res.setHeader("X-Cashu", paymentRequest);
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
  const paymentRequestPayload = { a: amount, u: "sat", m: [mintUrl] };
  const cborPayload = encodeCBOR(paymentRequestPayload);
  const encodedRequest =
    "creqA" + Buffer.from(cborPayload).toString("base64url");
  return encodedRequest;
}
