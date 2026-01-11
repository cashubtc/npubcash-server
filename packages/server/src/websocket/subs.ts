import { MintQuote } from "@/domain/mintQuote/MintQuote";
import { logger } from "@/utils/logger";

export class QuoteSubscriptionManager {
  private listeners = new Map<string, (quote: MintQuote) => void>();

  addListener(pubkey: string, cb: (quote: MintQuote) => void) {
    logger.debug(`Added websocket listener: ${pubkey}`);
    this.listeners.set(pubkey, cb);
    logger.debug(`${this.listeners.size} active listeners...`);
  }

  removeListener(pubkey: string) {
    logger.debug(`Removing websocket listener: ${pubkey}`);
    this.listeners.delete(pubkey);
  }
  update(pubkey: string, quote: MintQuote) {
    logger.debug(`${this.listeners.size} active listeners...`);
    logger.debug(`Sending websocket update for pubkey ${pubkey}`);
    const callback = this.listeners.get(pubkey);
    if (callback) {
      callback(quote);
    } else {
      logger.info("Did not send event! No listener");
    }
  }
}
