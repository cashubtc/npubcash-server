import { MintQuote } from "@/models/mint";
import { NextFunction, Request, Response } from "express";

export async function getBalanceHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authData = req.authData!;
    const balance = await MintQuote.getPaidMintAmount(authData.data.pubkey);
    res.json({ error: false, data: [{ balance, unit: "sat" }] });
  } catch (e) {
    next(e);
  }
}

export async function getPaidMintQuotes(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authData = req.authData!;
    const quotes = await MintQuote.getReadyMintQuotes(authData.data.pubkey);
    res.json({ error: false, data: { quotes } });
  } catch (e) {
    next(e);
  }
}
