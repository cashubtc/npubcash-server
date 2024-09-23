import { NextFunction, Request, Response } from "express";
import { Event, nip19 } from "nostr-tools";

import { parseInvoice } from ".././utils/lightning";
import { lnProvider, wallet } from "../config";
import { Transaction, User } from "../models";
import { createLnurlResponse } from "../utils/lnurl";
import { decodeAndValidateZapRequest } from "../utils/nostr";
import { createHash } from "crypto";
import { Analyzer } from "../utils/analytics";

export async function lnurlController(
  req: Request<
    { user: string },
    unknown,
    unknown,
    { amount?: string; nostr?: string }
  >,
  res: Response,
  next: NextFunction,
) {
  const { amount, nostr } = req.query;
  const userParam = req.params.user;
  let username: string | User | undefined;
  let zapRequest: Event | undefined;
  if (userParam.startsWith("npub")) {
    try {
      nip19.decode(userParam as `npub1${string}`);
      username = userParam;
    } catch {
      res.status(401);
      return next(new Error("Invalid npub / public key"));
    }
  } else {
    const userObj = await User.getUserByName(userParam.toLowerCase());
    if (!userObj) {
      res.status(404);
      return next(new Error("User not found"));
    }
    username = userObj.name;
  }
  if (!amount) {
    const lnurlResponse = createLnurlResponse(username);
    return res.json(lnurlResponse);
  }
  const parsedAmount = parseInt(amount);
  if (
    parsedAmount > Number(process.env.LNURL_MAX_AMOUNT) ||
    parsedAmount < Number(process.env.LNURL_MIN_AMOUNT)
  ) {
    const err = new Error("Invalid amount");
    return next(err);
  }
  if (nostr) {
    try {
      zapRequest = decodeAndValidateZapRequest(nostr, amount);
    } catch (e) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid zap request" });
    }
  }
  let mintPr: string,
    mintHash: string,
    invoiceRes: { paymentRequest: string; paymentHash: string };
  try {
    const mintRes = await wallet.requestMint(Math.floor(parsedAmount / 1000));
    ({ pr: mintPr, hash: mintHash } = mintRes);
  } catch (e) {
    console.log("Failed to create invoice: Mint failed");
    console.log(e);
    res.status(500);
    return res.json({ error: true, message: "Something went wrong..." });
  }

  const { amount: mintAmount, expiresIn } = parseInvoice(mintPr);

  //TODO:)Parse invoice for expiry and pass it to blink
  try {
    invoiceRes = await lnProvider.createInvoice(
      mintAmount / 1000,
      "Cashu Address",
      zapRequest
        ? createHash("sha256").update(JSON.stringify(zapRequest)).digest("hex")
        : undefined,
    );
  } catch (e) {
    console.log("Failed to create invoice: Invoice creation failed");
    console.log(e);
    res.status(500);
    return res.json({ error: true, message: "Something went wrong..." });
  }

  Analyzer.getInstance().logPaymentCreated(invoiceRes.paymentHash, expiresIn);
  try {
    await Transaction.createTransaction(
      mintPr,
      mintHash,
      invoiceRes.paymentRequest,
      invoiceRes.paymentHash,
      username,
      zapRequest,
      parsedAmount / 1000,
    );
    res.json({
      pr: invoiceRes.paymentRequest,
      routes: [],
    });
  } catch (e) {
    console.log("Failed to create invoice: Database connection failed");
    console.log(e);
    res.status(500);
    return res.json({ error: true, message: "Something went wrong..." });
  }
}
