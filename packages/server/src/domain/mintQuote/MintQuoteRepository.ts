import {
  MintQuote,
  MintQuoteState,
  CreateMintQuoteInput,
} from "./MintQuote";

export interface UserMintHistoryResult {
  total: number;
  quotes: MintQuote[];
}

export interface MintQuoteRepository {
  create(input: CreateMintQuoteInput): Promise<MintQuote>;
  updateState(id: number, state: MintQuoteState): Promise<void>;
  setPaid(id: number, paidAt?: Date): Promise<void>;
  getExpiredUnpaid(): Promise<MintQuote[]>;
  getPending(): Promise<MintQuote[]>;
  getUserHistory(
    pubkey: string,
    limit?: number,
    offset?: number,
    since?: Date
  ): Promise<UserMintHistoryResult>;
  bulkUpdateState(state: MintQuoteState, ids: number[]): Promise<void>;
}
