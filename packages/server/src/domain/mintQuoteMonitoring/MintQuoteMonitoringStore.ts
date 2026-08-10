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

export interface MintQuoteMonitoringStore {
  getById(id: number): Promise<MintQuote | undefined>;
  transitionState(
    transition: MintQuoteStateTransition,
  ): Promise<MintQuote | undefined>;
}
