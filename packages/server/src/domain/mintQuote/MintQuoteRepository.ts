import {
  MintQuote,
  CreateMintQuoteInput,
} from "./MintQuote";

export interface UserMintHistoryResult {
  total: number;
  quotes: MintQuote[];
}

export interface MintQuoteRepository {
  create(input: CreateMintQuoteInput): Promise<MintQuote>;
  getByVerificationToken(token: string): Promise<MintQuote | undefined>;
  getUserHistory(
    pubkey: string,
    limit?: number,
    offset?: number,
    since?: Date
  ): Promise<UserMintHistoryResult>;
}
