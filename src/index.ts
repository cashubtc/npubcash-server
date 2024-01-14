import express, { NextFunction, Request, Response } from "express";
import bodyparser from "body-parser";
import { CashuMint, CashuWallet, getEncodedToken } from "@cashu/cashu-ts";
import { getInvoice, payInvoice } from "./utils/lnbits";
import { parseInvoice } from "./utils/lightning";
import { MintData } from "./types";
import { encryptString } from "./utils/encryption";
import { createHash } from "crypto";

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
    const { pr, hash } = await wallet.requestMint(Math.floor(amount / 1000));
    const { amount: mintAmount } = parseInvoice(pr);
    const paymentMemo = encryptString(
      JSON.stringify({ mintPr: pr, mintHash: hash, user: "test" }),
    );
    const invoiceRes = await getInvoice(
      mintAmount,
      paymentMemo,
      "https://cashu.my2sats.space/paid",
      createHash("sha256").update(metadata).digest("hex"),
    );
    res.json({
      payment_request: invoiceRes.payment_request,
      payment_hash: invoiceRes.payment_hash,
    });
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
    const mintInfo = JSON.parse(memo) as MintData;
    const paymentData = await payInvoice(mintInfo.mintPr);
    const { proofs } = await wallet.requestTokens(amount, mintInfo.mintHash);
    const encoded = getEncodedToken({
      token: [{ mint: "https://8333.space:3338", proofs }],
    });
    console.log(encoded);
    // save encoded token in DB for user to claim later
  },
);

app.listen(process.env.PORT || 8000);
