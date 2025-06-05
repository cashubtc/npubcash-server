import { MintQuote } from "@/models/mint";
import { dateToUnix } from "@/utils/time";
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
      createdAt: dateToUnix(q.createdAt),
      paidAt: dateToUnix(q.paidAt!),
      expiresAt: dateToUnix(q.expiresAt),
      mintUrl: q.mintUrl,
      quoteId: q.quoteId,
      request: q.paymentRequest,
      amount: q.amount,
      state: q.state,
      locked: q.locked,
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
