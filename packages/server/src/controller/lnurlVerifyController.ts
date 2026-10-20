import { getMintQuoteRepository } from "@/config";
import { LnurlServiceUnavailableError } from "@/errors";
import type { NextFunction, Request, Response } from "express";

export async function lnurlVerifyController(
  req: Request<{ token: string }>,
  res: Response,
  next: NextFunction,
) {
  // A cached unpaid response must not hide a later payment.
  res.setHeader("Cache-Control", "no-store");
  try {
    const { token } = req.params;
    const quote = /^[0-9a-f]{64}$/.test(token)
      ? await getMintQuoteRepository().getByVerificationToken(token)
      : undefined;
    if (!quote) {
      return res.json({ status: "ERROR", reason: "Not found" });
    }

    return res.json({
      status: "OK",
      settled: quote.state === "PAID" || quote.state === "ISSUED",
      // Cashu mint quotes do not expose the incoming payment preimage.
      preimage: null,
      pr: quote.paymentRequest,
    });
  } catch (error) {
    return next(new LnurlServiceUnavailableError(error));
  }
}
