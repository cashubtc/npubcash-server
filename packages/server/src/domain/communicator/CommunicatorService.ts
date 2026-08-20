import { config } from "@/config/index";
import { MintQuote } from "@/domain/mintQuote/MintQuote";
import { MintQuoteRepository } from "@/domain/mintQuote/MintQuoteRepository";
import { eventBus } from "@/events";
import { logger } from "@/utils/logger";
import { handleZapRequest } from "@/utils/nostr";
import { normalizeUrl } from "@/utils/utils";
import { Mint, Wallet, type KeyChainCache, type Token } from "@cashu/cashu-ts";
import { MintCommunicator } from "almnd";
import { Logger } from "winston";
import {
  HybridSubscriptionManager,
  MintQuotePayload,
  UnsubscribeHandler,
} from "./infra";

export class CommunicatorService {
  private communicators: { [mintUrl: string]: MintCommunicator } = {};
  private subscriptionManager: HybridSubscriptionManager;
  private activeSubscriptions: Map<string, UnsubscribeHandler> = new Map();
  private mintQuoteRepository: MintQuoteRepository;
  private walletCache = new Map<string, any>();

  constructor(mintQuoteRepository: MintQuoteRepository) {
    this.mintQuoteRepository = mintQuoteRepository;
    this.subscriptionManager = new HybridSubscriptionManager({
      slowPollingIntervalMs: 20000,
      fastPollingIntervalMs: 5000,
      periodicReconnectMs: 180000, // 3 minutes
      logger,
    });
  }

  private async getWallet(mintUrl: string) {
    const cached = this.walletCache.get(mintUrl);
    if (cached) return cached;

    const mint = new Mint(mintUrl);
    const [mintInfo, { keysets }] = await Promise.all([
      mint.getInfo(),
      mint.getKeys(),
    ]);

    const wallet = new Wallet(mint);
    wallet.loadMintFromCache(mintInfo, {
      mintUrl,
      unit: "sat",
      keysets: keysets.map((ks) => ({
        id: ks.id,
        unit: ks.unit,
        active: ks.active ?? true,
        keys: ks.keys,
      })),
    } satisfies KeyChainCache);
    this.walletCache.set(mintUrl, wallet);
    return wallet;
  }

  async redeemToken(token: Token, logger?: Logger) {
    logger?.info(`Receiving proofs on mint ${token.mint}`);
    const wallet = await this.getWallet(token.mint);
    return wallet.receive(token);
  }

  async createMintQuote(
    amount: number,
    userData: { pubkey: string; lockQuote: boolean },
    mintUrl: string,
  ) {
    if (userData.lockQuote) {
      const res = await this.getCommunicator(mintUrl).getLockedMintQuote(
        amount,
        userData.pubkey,
      );
      return { locked: true, ...res };
    } else {
      const res = await this.getCommunicator(mintUrl).getMintQuote(amount);
      return { locked: false, ...res };
    }
  }

  createQuoteSubscription(quote: MintQuote, reqLogger: Logger) {
    const mintUrl = normalizeUrl(quote.mintUrl);
    const quoteId = quote.quoteId;

    // Check if already subscribed
    if (this.activeSubscriptions.has(quoteId)) {
      reqLogger.debug("[CommSvc] Already subscribed to quote", { quoteId });
      return;
    }

    reqLogger.info("[CommSvc] Creating hybrid subscription for quote", {
      mintUrl,
      quoteId,
    });

    const { subId, unsubscribe } = this.subscriptionManager.subscribe(
      mintUrl,
      quoteId,
      (payload: MintQuotePayload) => {
        this.handleQuoteUpdate(quote, payload, reqLogger, unsubscribe);
      },
    );

    this.activeSubscriptions.set(quoteId, unsubscribe);

    reqLogger.debug("[CommSvc] Subscribed to quote", {
      mintUrl,
      quoteId,
      subId,
    });
  }

  private async handleQuoteUpdate(
    quote: MintQuote,
    payload: MintQuotePayload,
    reqLogger: Logger,
    unsubscribe: UnsubscribeHandler,
  ) {
    reqLogger.debug("[CommSvc] Received quote update", {
      state: payload.state,
      quoteId: quote.quoteId,
    });

    if (payload.state === "PAID") {
      reqLogger.info("[CommSvc] Mint quote got paid", { quoteId: quote.quoteId });
      eventBus.emit("quotePaid", quote);
      await this.mintQuoteRepository.setPaid(quote.id);

      if (quote.serializedZapRequest && config.nostr.nostrEnabled) {
        try {
          const zapRequest = JSON.parse(quote.serializedZapRequest);
          handleZapRequest(quote.quoteId, zapRequest, quote.paymentRequest);
        } catch (e) {
          reqLogger.error("[CommSvc] Failed to handle zap request", { quoteId: quote.quoteId });
        }
      }

      this.cleanupSubscription(quote.quoteId, unsubscribe);
    } else if (payload.state === "ISSUED") {
      // Already minted, just cleanup
      reqLogger.debug("[CommSvc] Quote already issued", { quoteId: quote.quoteId });
      this.cleanupSubscription(quote.quoteId, unsubscribe);
    } else if (this.isExpired(payload.expiry)) {
      reqLogger.debug("[CommSvc] Mint quote expired", { quoteId: quote.quoteId });
      await this.mintQuoteRepository.updateState(quote.id, "EXPIRED");
      this.cleanupSubscription(quote.quoteId, unsubscribe);
    }
  }

  private isExpired(expiry: number): boolean {
    return expiry > 0 && Date.now() / 1000 > expiry;
  }

  private cleanupSubscription(
    quoteId: string,
    unsubscribe: UnsubscribeHandler,
  ) {
    unsubscribe();
    this.activeSubscriptions.delete(quoteId);
  }

  async setupPoller() {
    const pendingSubs = await this.mintQuoteRepository.getPending();
    logger.info("[CommSvc] Setup: Retrieved pending subscriptions from DB", {
      count: pendingSubs.length,
    });
    pendingSubs.forEach((quote) => {
      this.createQuoteSubscription(quote, logger);
    });
  }

  shutdown() {
    logger.info("[CommSvc] Shutting down");
    this.subscriptionManager.closeAll();
    this.activeSubscriptions.clear();
  }

  getCommunicator(mintUrl: string) {
    const parsedUrl = normalizeUrl(mintUrl);
    if (this.communicators[parsedUrl]) {
      return this.communicators[parsedUrl];
    }
    const comm = new MintCommunicator(parsedUrl, {
      initialPollingTimeout: { mint: 10000, melt: 10000, proof: 10000 },
      backoffFunction: (r) => Math.min(5000 * Math.pow(2, r), 600000),
      throttleCapacity: 10,
      throttleTimeout: 3500,
    });
    this.communicators[parsedUrl] = comm;
    return comm;
  }
}
