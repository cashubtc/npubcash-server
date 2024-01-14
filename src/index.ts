import express, { NextFunction, Request, Response } from "express";
import bodyparser from "body-parser";
import { CashuMint, CashuWallet, getEncodedToken } from "@cashu/cashu-ts";
import { getInvoice, payInvoice } from "./utils/lnbits";
import { parseInvoice } from "./utils/lightning";
import { Transaction } from "./models/transaction";
import { Claim } from "./models/proof";

const wallet = new CashuWallet(new CashuMint("https://8333.space:3338"));

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
      const invoiceRes = await getInvoice(
        mintAmount,
        JSON.stringify({ id: transaction.id }),
        "https://cashu.my2sats.space/paid",
      );
      console.log(invoiceRes);
      res.json({
        payment_request: invoiceRes.payment_request,
        payment_hash: invoiceRes.payment_hash,
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
    req: Request<unknown, unknown, { amount: number; memo: string }, unknown>,
    res: Response,
    next: NextFunction,
  ) => {
    const { amount, memo } = req.body;
    const mintInfo = JSON.parse(memo) as { id: number };
    const transaction = await Transaction.getTransactionFromDb(mintInfo.id);
    const paymentData = await payInvoice(transaction.mint_pr);
    console.log(paymentData);
    const { proofs } = await wallet.requestTokens(
      amount,
      transaction.mint_hash,
    );
    const encoded = getEncodedToken({
      token: [{ mint: "https://8333.space:3338", proofs }],
    });
    Claim.createClaim("test", encoded);
    console.log(encoded);
    res.sendStatus(200);
  },
);

app.listen(process.env.PORT || 8000);
