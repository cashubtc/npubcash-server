import type { MintQuotePayload } from "@/domain/mintQuoteMonitor/MintQuoteClient";

export interface QuoteWebSocketTransport {
  watch(
    mintUrl: string,
    quoteId: string,
    onPayload: (payload: MintQuotePayload) => void | Promise<void>,
  ): () => void;
  stop(): void;
}
