import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      authData?: SuccessfullAuthData;
    }
  }
}

export type FailedPayment = {
  id: number;
  created_at: string;
  server_pr: string;
  mint_pr: string;
  quote: string;
  user: string;
  amount: number;
  transaction_id: number;
};

export type AuthData =
  | { authorized: false }
  | { authorized: true; data: { pubkey: string; npub: string } };

export type SuccessfullAuthData = {
  authorized: true;
  data: { pubkey: string; npub: string };
};

export type MintData = {
  mintPr: string;
  mintHash: string;
  user: string;
};

export type LNBitsInvoiceData = {
  out: boolean;
  amount: number;
  memo?: string;
  webhook?: string;
  description_hash?: string;
  unhashed_description?: string;
};

export type LNBitsInvoiceResponse = {
  payment_hash: string;
  payment_request: string;
  checking_id: string;
  lnurl_response?: string;
};

export interface PaymentJWTPayload extends JwtPayload {
  username: string;
  pubkey: string;
  quoteId: string;
  paymentRequest: string;
  amount: number;
}

export type ZapRequestData = {
  pTags: string[];
  eTags: string[];
  aTags: string[];
  relays: string[];
  amount?: number;
};

export type ClaimStatus = "ready" | "inflight" | "spent";
