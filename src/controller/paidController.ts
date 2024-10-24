import { Request, Response } from "express";
import { lnProvider, wallet } from "../config";
import { Claim, Transaction } from "../models";
import {
  createZapReceipt,
  extractZapRequestData,
  publishZapReceipt,
} from "../utils/nostr";
import { Analyzer } from "../utils/analytics";

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
    let internalTx: Transaction | undefined;
    const logger = Analyzer.getInstance();
    logger.logPaymentSettled(reqHash);
    try {
      internalTx = await Transaction.getTransactionByHash(reqHash);
      if (internalTx.zap_request && process.env.ZAP_SECRET_KEY) {
        try {
          const zapRequestData = extractZapRequestData(internalTx.zap_request);
          const zapReceipt = createZapReceipt(
            Math.floor(Date.now() / 1000),
            zapRequestData.pTags[0],
            zapRequestData.eTags[0],
            zapRequestData.aTags[0],
            internalTx.server_pr,
            internalTx.zap_request,
          );
          const pubResults = await publishZapReceipt(
            zapReceipt,
            zapRequestData.relays.length > 0
              ? zapRequestData.relays
              : undefined,
          );
          pubResults.forEach((p) => {
            if (p.status === "rejected") {
              console.warn("receipt publish failed: ", p.reason);
            } else {
              console.log("receipt published successfully! ", p.value);
            }
          });
        } catch (e) {
          console.log(e);
        }
      }
      try {
        await lnProvider.payInvoice(internalTx.mint_pr);
      } catch (e) {
        console.error(e);
        console.error("Could not pay mint invoice!");
      }
      const { proofs } = await wallet.requestTokens(
        transaction.settlementAmount,
        internalTx.mint_hash,
      );
      await Claim.createClaims(
        internalTx.user,
        process.env.MINTURL!,
        proofs,
        internalTx.id,
      );
      await Transaction.setToFulfilled(internalTx.id);
      res.sendStatus(200);
    } catch (e) {
      if (internalTx) {
        await internalTx.recordFailedPayment();
        console.error("Failed to create Claim");
      }
      console.error(e);
      return res.sendStatus(200);
    }
  } else {
    return res.sendStatus(200);
  }
}
