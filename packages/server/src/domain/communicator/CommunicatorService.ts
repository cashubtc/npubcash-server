import { MintQuote } from "@/domain/mintQuote/MintQuote";
import type { MintQuoteMonitor } from "@/domain/mintQuoteMonitor/MintQuoteMonitor";
import { normalizeUrl } from "@/utils/utils";
import { Mint, Wallet, type Token } from "@cashu/cashu-ts";
import { MintCommunicator } from "almnd";
import type { Logger } from "winston";

export class CommunicatorService {
  private readonly communicators: { [mintUrl: string]: MintCommunicator } = {};

  constructor(private readonly mintQuoteMonitor: MintQuoteMonitor) {}

  async redeemToken(token: Token, logger?: Logger) {
    logger?.info(`Receiving proofs on mint ${token.mint}`);
    const mint = new Mint(token.mint);
    const mintInfo = await mint.getInfo();
    const { keysets: rawKeysets } = await mint.getKeys();
    const keysetCache = await Promise.all(
      rawKeysets.map(async (ks: any) => {
        const { keysets: [keyset] } = await mint.getKeys(ks.id) as any;
        return { id: ks.id, unit: ks.unit, active: ks.active ?? true, keys: keyset.keys };
      }),
    );
    const wallet = new Wallet(mint);
    wallet.loadMintFromCache(mintInfo as any, {
      mintUrl: token.mint,
      unit: "sat",
      keysets: keysetCache as any,
    });
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
    }
    const res = await this.getCommunicator(mintUrl).getMintQuote(amount);
    return { locked: false, ...res };
  }

  async createQuoteSubscription(quote: MintQuote, reqLogger: Logger) {
    reqLogger.info("[CommSvc] Monitoring mint quote", {
      mintUrl: normalizeUrl(quote.mintUrl),
      quoteId: quote.quoteId,
    });
    await this.mintQuoteMonitor.watch(quote);
  }

  async startQuoteMonitoring(): Promise<void> {
    await this.mintQuoteMonitor.start();
  }

  async shutdown(): Promise<void> {
    await this.mintQuoteMonitor.stop();
  }

  getCommunicator(mintUrl: string) {
    const parsedUrl = normalizeUrl(mintUrl);
    if (this.communicators[parsedUrl]) {
      return this.communicators[parsedUrl];
    }
    const communicator = new MintCommunicator(parsedUrl, {
      initialPollingTimeout: { mint: 10_000, melt: 10_000, proof: 10_000 },
      backoffFunction: (retry) =>
        Math.min(5_000 * Math.pow(2, retry), 600_000),
      throttleCapacity: 10,
      throttleTimeout: 3_500,
    });
    this.communicators[parsedUrl] = communicator;
    return communicator;
  }
}
