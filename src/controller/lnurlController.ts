import { NextFunction, Request, Response } from "express";

import { User } from ".././models/user";
import { parseInvoice } from ".././utils/lightning";
import { createInvoice } from ".././utils/blink";
import { Transaction } from ".././models/transaction";
import { wallet } from "..";

export async function lnurlController(
  req: Request<{ user: string }, unknown, unknown, { amount?: number }>,
  res: Response,
  next: NextFunction,
) {
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
    const invoiceRes = await createInvoice(mintAmount / 1000, "Cashu Address");
    await Transaction.createTransaction(
      mintPr,
      mintHash,
      invoiceRes.paymentRequest,
      invoiceRes.paymentHash,
      user.name,
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
}
