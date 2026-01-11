import { mintQuoteRepository } from "@/config";
import { MintQuote } from "@/domain/mintQuote/MintQuote";
import { dateToUnix } from "@/utils/time";
import { NextFunction, Request, Response } from "express";
import { Quote, QuotesResponse, ReponseMetadata } from "@npubcash/types";

interface MintQuoteQuery {
  limit?: string;
  since?: string;
  offset?: string;
}

interface ParsedQuery {
  offset?: number;
  limit: number;
  since?: Date;
}

export async function getMintQuotes(
  req: Request<unknown, unknown, unknown, MintQuoteQuery>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authData = req.authData!;

    const parsedQuery = parseQueryParameters(req.query);

    const lastQuotes = await mintQuoteRepository.getUserHistory(
      authData.data.pubkey,
      parsedQuery.limit,
      parsedQuery.offset,
      parsedQuery.since,
    );

    const quotes = lastQuotes.quotes.map(mapMintQuoteToResponse);
    const metadata = createMetadata(parsedQuery, lastQuotes.total);

    const response: QuotesResponse = {
      error: false,
      data: { quotes },
      metadata,
    };

    res.json(response);
  } catch (e) {
    next(e);
  }
}

function parseQueryParameters(query: MintQuoteQuery): ParsedQuery {
  const { offset, limit, since } = query;

  const parsedOffset = offset ? parseInt(offset, 10) : undefined;
  const parsedLimit = limit ? parseInt(limit, 10) : 50;
  const parsedSince = since ? new Date(parseInt(since, 10) * 1000) : undefined;

  if (offset && (isNaN(parsedOffset!) || parsedOffset! < 0)) {
    throw new Error("Invalid offset parameter");
  }

  if (limit && (isNaN(parsedLimit) || parsedLimit <= 0 || parsedLimit > 1000)) {
    throw new Error("Invalid limit parameter (must be between 1 and 1000)");
  }

  if (since && isNaN(parsedSince!.getTime())) {
    throw new Error("Invalid since parameter");
  }

  return {
    offset: parsedOffset,
    limit: parsedLimit,
    since: parsedSince,
  };
}

function mapMintQuoteToResponse(mintQuote: any): Quote {
  return {
    createdAt: dateToUnix(mintQuote.createdAt),
    paidAt: dateToUnix(mintQuote.paidAt!),
    expiresAt: dateToUnix(mintQuote.expiresAt),
    mintUrl: mintQuote.mintUrl,
    quoteId: mintQuote.quoteId,
    request: mintQuote.paymentRequest,
    amount: mintQuote.amount,
    state: mintQuote.state,
    locked: mintQuote.locked,
    ...(mintQuote.serializedZapRequest && {
      zapRequest: mintQuote.serializedZapRequest,
    }),
  };
}

function createMetadata(
  parsedQuery: ParsedQuery,
  total: number,
): ReponseMetadata {
  return {
    ...(parsedQuery.since && {
      since: dateToUnix(parsedQuery.since),
    }),
    ...(parsedQuery.offset && { offset: parsedQuery.offset }),
    total,
    limit: parsedQuery.limit,
  };
}
