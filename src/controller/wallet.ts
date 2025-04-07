import { MintQuote } from "@/models/mint";
import { NextFunction, Request, Response } from "express";

export async function getMintQuotes(
  req: Request<unknown, unknown, unknown, { page?: string; since: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const authData = req.authData!;
    const { page, since } = req.query;
    const selectedPage = page ? parseInt(page) : 1;
    const selectedSince = since ? new Date(parseInt(since) * 1000) : undefined;
    const lastQuotes = await MintQuote.getUserMintHistory(
      authData.data.pubkey,
      selectedPage,
      selectedSince,
    );
    const payload = lastQuotes.map((q) => ({
      created_at: Math.floor(q.created_at.getTime() / 1000),
      mint_url: q.mint_url,
      quote_id: q.quote_id,
      amount: q.amount,
      state: q.state,
    }));
    res.json({ error: false, data: { quotes: payload } });
  } catch (e) {
    next(e);
  }
}
