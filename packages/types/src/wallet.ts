import { type ErrorResponse } from "./common";

export type Quote = {
  createdAt: number;
  paidAt: number;
  expiresAt: number;
  mintUrl: string;
  quoteId: string;
  request: string;
  amount: number;
  state: string;
  locked: boolean;
  zapRequest?: string;
};

export type QuotesResponse = {
  error: false;
  data: { quotes: Quote[] };
  metadata: ReponseMetadata;
};

export type ReponseMetadata = {
  since?: number;
  offset?: number;
  total: number;
  limit: number;
};

export type MintQuotesResponseType = QuotesResponse | ErrorResponse;
