import { MintCommunicator } from "almnd";
import { MintQuote } from "./models/mint";
import { logger } from "./utils/logger";
import { handleZapRequest } from "./utils/nostr";
import { AppConfig } from "./config/index";
import { Logger } from "winston";

const config = AppConfig.getInstance();

export const comm = new MintCommunicator(process.env.MINTURL!, {
  initialPollingTimeout: { mint: 10000, melt: 10000, proof: 10000 },
  backoffFunction: (r) => Math.min(5000 * Math.pow(2, r), 600000),
  throttleCapacity: 10,
  throttleTimeout: 3500,
});

export async function setupPoller() {
  const pendingSubs = await MintQuote.getPendingMintQuotes();
  logger.debug(
    `Poller-Setup: Retrieved ${pendingSubs.length} pending subs from DB`,
  );
  pendingSubs.forEach((quote) => {
    const sub = comm.pollForMintQuote(quote.quote_id);
    handleSubscription(sub, quote, logger);
  });
}

export function handleSubscription(
  sub: ReturnType<MintCommunicator["pollForMintQuote"]>,
  quote: MintQuote,
  logger: Logger,
) {
  sub.on("polling", () => {
    logger?.debug("Polling for mint quote update: ", quote.quote_id);
  });
  sub.on("paid", () => {
    logger?.debug("Mint quote got paid", quote.quote_id);
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
    quote.setStateAndUpdateDb("EXPIRED");
    sub.cancel();
  });
}
