import { MintQuote, MintQuoteState } from "@/domain/mintQuote/MintQuote";

export type MintRetryErrorCategory = "mint_unavailable";

export interface MintRetryState {
  mintUrl: string;
  failureCount: number;
  nextAttemptAt: Date;
  lastFailureAt: Date;
  lastErrorCategory: MintRetryErrorCategory;
}

export type QuoteCheckCategory =
  | "scheduled"
  | "unpaid"
  | "pending"
  | "not_found"
  | "invalid_response";

export interface QuoteReconciliationState {
  mintQuoteId: number;
  lastCheckedAt?: Date;
  nextCheckAt: Date;
  notFoundCount: number;
  lastResult: QuoteCheckCategory;
}

/** Internal persistence seam owned by MintQuoteMonitor. */
export interface MintQuoteMonitorStore {
  getRecoverableQuotes(): Promise<MintQuote[]>;
  transitionUnpaidQuote(
    id: number,
    state: Extract<MintQuoteState, "PAID" | "ISSUED" | "EXPIRED">,
    paidAt?: Date,
  ): Promise<MintQuote | undefined>;
  getMintRetryState(mintUrl: string): Promise<MintRetryState | undefined>;
  saveMintRetryState(state: MintRetryState): Promise<void>;
  clearMintRetryState(mintUrl: string): Promise<void>;
  getQuoteReconciliationState(
    mintQuoteId: number,
  ): Promise<QuoteReconciliationState | undefined>;
  saveQuoteReconciliationState(
    state: QuoteReconciliationState,
  ): Promise<void>;
  clearQuoteReconciliationState(mintQuoteId: number): Promise<void>;
}
