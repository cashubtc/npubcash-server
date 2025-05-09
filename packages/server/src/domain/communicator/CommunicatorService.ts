import { AppConfig } from "@/config/index";
import { MintQuote } from "@/models/mint";
import { logger } from "@/utils/logger";
import { handleZapRequest } from "@/utils/nostr";
import { MintQuoteResponse } from "@cashu/cashu-ts";
import { MintCommunicator } from "almnd";
import { Logger } from "winston";

const config = AppConfig.getInstance();

export class CommunicatorService {
  constructor(
    private readonly communicator = new MintCommunicator(process.env.MINTURL!, {
      initialPollingTimeout: { mint: 10000, melt: 10000, proof: 10000 },
      backoffFunction: (r) => Math.min(5000 * Math.pow(2, r), 600000),
      throttleCapacity: 10,
      throttleTimeout: 3500,
    }),
  ) {}

  async createMintQuote(amount: number) {
    return this.communicator.getMintQuote(amount);
  }

  createQuoteSubscription(quote: MintQuote, logger: Logger) {
    const expiry = Math.floor(quote.expires_at.getTime() / 1000);
    const sub = this.communicator.pollForMintQuote(quote.quote_id, expiry);
    sub.on("polling", () => {
      logger?.debug(
        `Polling for mint quote update: ${quote.quote_id}`,
        quote.quote_id,
      );
    });
    sub.on("paid", () => {
      logger?.debug(`Mint quote got paid: ${quote.quote_id}`, quote);
      quote.setPaid();
      if (quote.serialized_zap_request && config.nostr.nostrEnabled) {
        try {
          const zapRequest = JSON.parse(quote.serialized_zap_request);
          handleZapRequest(quote.quote_id, zapRequest, quote.payment_request);
        } catch (e) {
          logger?.error(
            `Failed to handle zap request for quote: ${quote.quote_id}`,
          );
        }
      }
      sub.cancel();
    });
    sub.on("expired", () => {
      logger?.debug(`Mint quote expired: ${quote.quote_id}`);
      quote.setStateAndUpdateDb("EXPIRED");
      sub.cancel();
    });
  }

  async setupPoller() {
    const pendingSubs = await MintQuote.getPendingMintQuotes();
    logger.debug(
      `Poller-Setup: Retrieved ${pendingSubs.length} pending subs from DB`,
    );
    pendingSubs.forEach((quote) => {
      this.createQuoteSubscription(quote, logger);
    });
  }
}
