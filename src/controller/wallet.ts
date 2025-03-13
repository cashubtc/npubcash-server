import { MintQuote } from "@/models/mint";
import { NextFunction, Request, Response } from "express";

export async function getBalanceHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authData = req.authData!;
    console.log("Getting balance");
    const balance = await MintQuote.getUserPaidMintAmount(authData.data.pubkey);
    res.json({ error: false, data: [{ balance, unit: "sat" }] });
  } catch (e) {
    next(e);
  }
}
