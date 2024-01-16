import { NextFunction, Request, Response } from "express";
import { Transaction } from "../models/transaction";
import { sendPayment } from "../utils/blink";
import { wallet } from "..";
import { getEncodedToken } from "@cashu/cashu-ts";
import { Claim } from "../models/claim";

export async function paidController(
  req: Request<
    unknown,
    unknown,
    {
      eventType: string;
      transaction: {
        memo: string;
        settlementAmount: number;
        initiationVia: { paymentHash: string };
      };
    },
    unknown
  >,
  res: Response,
) {
  const { eventType, transaction } = req.body;
  if (eventType === "receive.lightning") {
    const reqHash = transaction.initiationVia.paymentHash;
    const internalTx = await Transaction.getTransactionByHash(reqHash);
    try {
      await sendPayment(internalTx.mint_pr);
    } catch (e) {
      // TO-DO log failed payment and retry
    }
    const { proofs } = await wallet.requestTokens(
      transaction.settlementAmount,
      internalTx.mint_hash,
    );
    const encoded = getEncodedToken({
      token: [{ mint: process.env.MINTURL!, proofs }],
    });
    Claim.createClaim(internalTx.user, encoded);
    res.sendStatus(200);
  } else {
    return res.sendStatus(200);
  }
}
