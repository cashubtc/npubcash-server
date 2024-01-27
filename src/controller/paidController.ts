import { Request, Response } from "express";
import { Transaction } from "../models/transaction";
import { lnProvider, wallet } from "..";
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
    const newAmount =
      Number(transaction.settlementAmount) -
      Math.floor(Math.max(Number(transaction.settlementAmount) / 100, 1));
    const reqHash = transaction.initiationVia.paymentHash;
    const internalTx = await Transaction.getTransactionByHash(reqHash);
    try {
      await lnProvider.payInvoice(internalTx.mint_pr);
    } catch (e) {
      // TO-DO log failed payment and retry
    }
    const { proofs } = await wallet.requestTokens(
      newAmount,
      internalTx.mint_hash,
    );
    Claim.createClaim(internalTx.user, process.env.MINTURL!, proofs);
    res.sendStatus(200);
  } else {
    return res.sendStatus(200);
  }
}
