import type { MintQuote, MintQuoteState } from "@/domain/mintQuote/MintQuote";

export interface MintQuoteStateTransition {
  id: number;
  from: readonly MintQuoteState[];
  to: Extract<MintQuoteState, "PAID" | "ISSUED" | "EXPIRED">;
  paidAt?: Date;
}

export interface DueMintQueue {
  mintUrl: string;
  mintUrlAliases: readonly string[];
  oldestDueAt: Date | null;
}

export interface ListDueMintQueuesInput {
  dueBefore: Date;
  limit: number;
  excludedMintUrls: readonly string[];
}

export interface TakeDueForMintPollingInput {
  mintUrlAliases: readonly string[];
  dueBefore: Date;
  polledAt: Date;
  limit: number;
}

export interface MintQuoteMonitoringStore {
  getActiveUnpaidQuotes(now: Date): Promise<MintQuote[]>;
  listDueMintQueues(input: ListDueMintQueuesInput): Promise<DueMintQueue[]>;
  takeDueForMintPolling(
    input: TakeDueForMintPollingInput,
  ): Promise<MintQuote[]>;
  getById(id: number): Promise<MintQuote | undefined>;
  transitionState(
    transition: MintQuoteStateTransition,
  ): Promise<MintQuote | undefined>;
}
