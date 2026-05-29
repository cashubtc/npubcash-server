import { NextFunction, Request, Response } from "express";
import { Event, nip19 } from "nostr-tools";
import { MintQuoteBolt11Response } from "@cashu/cashu-ts";
import { createHash } from "crypto";

import { wallet } from "../config";
import { Transaction, User } from "../models";
import { createLnurlResponse } from "../utils/lnurl";
import { decodeAndValidateZapRequest } from "../utils/nostr";
import { Analyzer } from "../utils/analytics";
import { PaymentSettlementService } from "../services/paymentSettlement";

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
  const quoteAmount = Math.floor(parsedAmount / 1000);
  let quote: MintQuoteBolt11Response;
  try {
    if (zapRequest) {
      quote = await wallet.createMintQuote<MintQuoteBolt11Response>("bolt11", {
        amount: quoteAmount,
        description_hash: createHash("sha256")
          .update(JSON.stringify(zapRequest))
          .digest("hex"),
      });
    } else {
      quote = await wallet.createMintQuoteBolt11(quoteAmount, "Cashu Address");
    }
  } catch (e) {
    console.log("Failed to create invoice: Mint failed");
    console.log(e);
    res.status(500);
    return res.json({ error: true, message: "Something went wrong..." });
  }

  Analyzer.getInstance().logPaymentCreated(
    quote.quote,
    quote.expiry ? quote.expiry - Math.floor(Date.now() / 1000) : 3600,
  );
  try {
    const transaction = await Transaction.createCashuTransaction(
      quote.quote,
      quote.request,
      username,
      zapRequest,
      parsedAmount / 1000,
    );
    PaymentSettlementService.getInstance().startWatchingTransaction(
      transaction,
    );
    res.json({
      pr: quote.request,
      routes: [],
    });
  } catch (e) {
    console.log("Failed to create invoice: Database connection failed");
    console.log(e);
    res.status(500);
    return res.json({ error: true, message: "Something went wrong..." });
  }
}
