import express, { NextFunction, Request, Response } from "express";
import bodyparser from "body-parser";
import { CashuMint, CashuWallet, getEncodedToken } from "@cashu/cashu-ts";
import { parseInvoice } from "./utils/lightning";
import { Transaction } from "./models/transaction";
import { Claim } from "./models/claim";
import { createInvoice, sendPayment } from "./utils/blink";
import { finalizeEvent, getPublicKey } from "nostr-tools";
import { verifyAuth } from "./utils/auth";
import { User } from "./models/user";

const wallet = new CashuWallet(new CashuMint(process.env.MINTURL!));

const app = express();

app.use(bodyparser.json());

app.get(
  "/.well-known/lnurlp/:user",
  async (
    req: Request<{ user: string }, unknown, unknown, { amount?: number }>,
    res: Response,
    next: NextFunction,
  ) => {
    const { amount } = req.query;
    const user = await User.getUserByName(req.params.user);
    if (!user) {
      res.status(404);
      return next(new Error("User not found"));
    }
    const metadata = "A cashu lightning address! Neat!";
    if (!amount) {
      return res.json({
        callback: `https://cashu.my2sats.space/.well-known/lnurlp/${user?.name}`,
        maxSendable: 250000,
        minSendable: 1,
        metadata: [["text/plain", metadata]],
        tag: "payRequest",
      });
    }
    if (amount > 250000 || amount < 1000) {
      const err = new Error("Invalid amount");
      return next(err);
    }
    const { pr: mintPr, hash: mintHash } = await wallet.requestMint(
      Math.floor(amount / 1000),
    );
    const { amount: mintAmount } = parseInvoice(mintPr);
    try {
      const invoiceRes = await createInvoice(
        mintAmount / 1000,
        "Cashu Address",
      );
      await Transaction.createTransaction(
        mintPr,
        mintHash,
        invoiceRes.paymentRequest,
        invoiceRes.paymentHash,
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
        transaction: {
          memo: string;
          settlementAmount: number;
          initiationVia: { paymentHash: string };
        };
      },
      unknown
    >,
    res: Response,
  ) => {
    const { eventType, transaction } = req.body;
    if (eventType === "receive.lightning") {
      const reqHash = transaction.initiationVia.paymentHash;
      const internalTx = await Transaction.getTransactionByHash(reqHash);
      const paymentData = await sendPayment(internalTx.mint_pr);
      console.log(paymentData);
      const { proofs } = await wallet.requestTokens(
        transaction.settlementAmount,
        internalTx.mint_hash,
      );
      const encoded = getEncodedToken({
        token: [{ mint: process.env.MINTURL!, proofs }],
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
  const isAuth = await verifyAuth(
    authHeader,
    "http://localhost:8000/claim",
    "GET",
  );
  if (!isAuth.authorized) {
    res.status(401);
    return next(new Error("Unauthorized"));
  }
  const user = await User.getUserByPubkey(isAuth.data.pubkey);
  if (!user) {
    res.status(404);
    return next(new Error("User not found"));
  }
  console.log(user);
  const claims = await Claim.getUserClaims(user.name);
  console.log(claims);
});

app.listen(process.env.PORT || 8000);
