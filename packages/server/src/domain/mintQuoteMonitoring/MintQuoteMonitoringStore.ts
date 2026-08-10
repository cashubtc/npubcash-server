import type {
  MintQuote,
  MintQuoteState,
} from "@/domain/mintQuote/MintQuote";

export interface MintQuoteStateTransition {
  id: number;
  from: readonly MintQuoteState[];
  to: Extract<MintQuoteState, "PAID" | "ISSUED" | "EXPIRED">;
  paidAt?: Date;
}

export interface TakeDueForPollingInput {
  dueBefore: Date;
  polledAt: Date;
  limit: number;
}

export interface MintQuoteMonitoringStore {
  getActiveUnpaidQuotes(now: Date): Promise<MintQuote[]>;
  takeDueForPolling(input: TakeDueForPollingInput): Promise<MintQuote[]>;
  getById(id: number): Promise<MintQuote | undefined>;
  transitionState(
    transition: MintQuoteStateTransition,
  ): Promise<MintQuote | undefined>;
}
