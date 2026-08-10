import type { MintQuote } from "@/domain/mintQuote/MintQuote";
import type { MintQuotePayload } from "@/domain/mintQuoteMonitor/MintQuoteClient";

export type QuoteObservationSource = "polling" | "websocket";

export type QuoteObservation =
  | {
      source: "polling";
      mintQuoteId: number;
      requestStartedAt: Date;
      result:
        | { kind: "found"; payload: MintQuotePayload }
        | { kind: "not_found" };
    }
  | {
      source: "websocket";
      mintQuoteId: number;
      payload: MintQuotePayload;
    };

export interface QuoteStateChange {
  quote: MintQuote;
  source: QuoteObservationSource;
}
