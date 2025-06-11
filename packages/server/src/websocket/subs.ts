import { eventBus } from "@/events";
import { MintQuote } from "@/models/mint";
import { logger } from "@/utils/logger";

class QuoteSubscriptionManager {
  private listeners = new Map<string, (quote: MintQuote) => void>();

  addListener(pubkey: string, cb: (quote: MintQuote) => void) {
    logger.debug(`Added websocket listener: ${pubkey}`);
    this.listeners.set(pubkey, cb);
  }

  removeListener(pubkey: string) {
    this.listeners.delete(pubkey);
  }
  update(pubkey: string, quote: MintQuote) {
    logger.debug(`Sending websocket update for pubkey ${pubkey}`);
    const callback = this.listeners.get(pubkey);
    if (callback) {
      callback(quote);
    }
  }
}

export const subManager = new QuoteSubscriptionManager();
eventBus.on("quotePaid", (quote) => {
  subManager.update(quote.pubkey, quote);
});
