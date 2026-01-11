export type MintQuoteState =
  | "PAID"
  | "UNPAID"
  | "INFLIGHT"
  | "ISSUED"
  | "EXPIRED";

export interface MintQuoteConfig {
  id: number;
  createdAt: Date;
  mintUrl: string;
  unit: string;
  paymentRequest: string;
  quoteId: string;
  expiresAt: Date;
  amount: number;
  pubkey: string;
  state: MintQuoteState;
  paidAt?: Date;
  serializedZapRequest?: string;
  locked: boolean;
}

export type CreateMintQuoteInput = Omit<
  MintQuoteConfig,
  "id" | "createdAt" | "state"
>;

export class MintQuote implements MintQuoteConfig {
  id: number;
  createdAt: Date;
  mintUrl: string;
  unit: string;
  paymentRequest: string;
  quoteId: string;
  expiresAt: Date;
  amount: number;
  pubkey: string;
  state: MintQuoteState;
  paidAt?: Date;
  serializedZapRequest?: string;
  locked: boolean;

  constructor(config: MintQuoteConfig) {
    this.id = config.id;
    this.createdAt = config.createdAt;
    this.mintUrl = config.mintUrl;
    this.unit = config.unit;
    this.paymentRequest = config.paymentRequest;
    this.quoteId = config.quoteId;
    this.expiresAt = config.expiresAt;
    this.amount = config.amount;
    this.pubkey = config.pubkey;
    this.state = config.state;
    this.paidAt = config.paidAt;
    this.serializedZapRequest = config.serializedZapRequest;
    this.locked = config.locked;
  }
}
