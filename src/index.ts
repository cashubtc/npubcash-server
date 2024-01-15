import express, { NextFunction, Request, Response } from "express";
import bodyparser from "body-parser";
import { CashuMint, CashuWallet, getEncodedToken } from "@cashu/cashu-ts";
import { getInvoice, payInvoice } from "./utils/lnbits";
import { parseInvoice } from "./utils/lightning";
import { Transaction } from "./models/transaction";
import { Claim } from "./models/claim";
import { createInvoice, sendPayment } from "./utils/blink";

const wallet = new CashuWallet(new CashuMint(process.env.MINTURL!));

const app = express();

app.use(bodyparser.json());

app.get(
  "/.well-known/lnurlp/test",
  async (
    req: Request<unknown, unknown, unknown, { amount?: number }>,
    res: Response,
    next: NextFunction,
  ) => {
    const { amount } = req.query;
    const metadata = "A cashu lightning address! Neat!";
    if (!amount) {
      return res.json({
        callback: "",
        maxSendable: 1000,
        minSendable: 250000,
        metadata: [["text/plain", metadata]],
        tag: "payRequest",
      });
    }
    if (amount > 250000 || amount < 1000) {
      const err = new Error("Invalid amount");
      return next(err);
    }
    const { pr, hash } = await wallet.requestMint(Math.floor(amount / 1000));
    const { amount: mintAmount } = parseInvoice(pr);
    const transaction = await Transaction.createTransaction(pr, hash);
    try {
      const invoiceRes = await createInvoice(
        mintAmount / 1000,
        JSON.stringify({ id: transaction.id }),
      );
      res.json({
        pr: invoiceRes.paymentRequest,
        routes: [],
      });
    } catch (e) {
      console.log(e);
      res.status(500);
      res.json({ error: true, message: "Something went wrong..." });
    }
  },
);

app.post(
  "/paid",
  async (
    req: Request<
      unknown,
      unknown,
      {
        eventType: string;
        transaction: { memo: string; settlementAmount: number };
      },
      unknown
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const { eventType, transaction } = req.body;
    if (eventType === "receive.lightning") {
      console.log(transaction);
      const mintInfo = JSON.parse(transaction.memo) as { id: number };
      const internalTx = await Transaction.getTransactionFromDb(mintInfo.id);
      const paymentData = await payInvoice(internalTx.mint_pr);
      const { proofs } = await wallet.requestTokens(
        transaction.settlementAmount,
        internalTx.mint_hash,
      );
      const encoded = getEncodedToken({
        token: [{ mint: "https://8333.space:3338", proofs }],
      });
      Claim.createClaim("test", encoded);
      console.log(encoded);
      res.sendStatus(200);
    } else {
      return res.sendStatus(200);
    }
  },
);

app.get("/claim", async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    res.status(401);
    return next(new Error("Unauthorized"));
  }
});

app.listen(process.env.PORT || 8000);
