import { MintQuote } from "@/models/mint";
import { NextFunction, Request, Response } from "express";

export async function getMintQuotes(
  req: Request<
    unknown,
    unknown,
    unknown,
    { limit?: string; since?: string; offset?: string }
  >,
  res: Response,
  next: NextFunction,
) {
  try {
    const authData = req.authData!;
    const { offset, limit, since } = req.query;
    const selectedOffset = offset ? parseInt(offset) : undefined;
    const selectedLimit = limit ? parseInt(limit) : 50;
    const selectedSince = since ? new Date(parseInt(since) * 1000) : undefined;
    const lastQuotes = await MintQuote.getUserMintHistory(
      authData.data.pubkey,
      selectedLimit,
      selectedOffset,
      selectedSince,
    );
    const payload = lastQuotes.mints.map((q) => ({
      created_at: Math.floor(q.created_at.getTime() / 1000),
      paid_at: Math.floor(q.paid_at!.getTime() / 1000),
      mint_url: q.mint_url,
      quote_id: q.quote_id,
      amount: q.amount,
      state: q.state,
    }));
    res.json({
      error: false,
      data: { quotes: payload },
      metadata: {
        ...(selectedSince
          ? { since: Math.floor(selectedSince?.getTime() / 1000) }
          : {}),
        ...(selectedOffset ? { offset: selectedOffset } : {}),
        total: lastQuotes.total,
        limit: selectedLimit,
      },
    });
  } catch (e) {
    next(e);
  }
}
