import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      authData?: SuccessfullAuthData;
    }
  }
}

export interface PaymentProvider {
  createInvoice: (
    amount: number,
    memo?: string,
  ) => Promise<{
    paymentRequest: string;
    paymentHash: string;
    paymentSecret: string;
  }>;
  payInvoice: (invoice: string) => Promise<PaymentResponse>;
  checkPayment: (invoice: string) => Promise<{ paid: boolean }>;
}

type PaymentResponse<TStatus = boolean> = TStatus extends true
  ? { paid: TStatus; preimage: string }
  : { paid: TStatus };

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
  paymentRequest: string;
}
