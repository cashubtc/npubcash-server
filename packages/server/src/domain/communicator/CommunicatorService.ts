import { MintQuote } from "@/domain/mintQuote/MintQuote";
import type { MintQuoteMonitor } from "@/domain/mintQuoteMonitor/MintQuoteMonitor";
import { normalizeUrl } from "@/utils/utils";
import { Mint, Wallet, type Token } from "@cashu/cashu-ts";
import { MintCommunicator } from "almnd";
import type { Logger } from "winston";

export class CommunicatorService {
  private readonly communicators: { [mintUrl: string]: MintCommunicator } = {};
  private walletCache = new Map<string, any>();

  constructor(private readonly mintQuoteMonitor: MintQuoteMonitor) {}

  private async getWallet(mintUrl: string) {
    const cached = this.walletCache.get(mintUrl);
    if (cached) return cached;

    const mint = new Mint(mintUrl);
    const [mintInfo, { keysets: rawKeysets }] = await Promise.all([
      mint.getInfo(),
      mint.getKeys(),
    ]);
    const keysetCache = await Promise.all(
      rawKeysets.map(async (ks: any) => {
        const { keysets: [keyset] } = await mint.getKeys(ks.id) as any;
        return { id: ks.id, unit: ks.unit, active: ks.active ?? true, keys: keyset.keys };
      }),
    );
    const wallet = new Wallet(mint);
    wallet.loadMintFromCache(mintInfo as any, {
      mintUrl,
      unit: "sat",
      keysets: keysetCache as any,
    });
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
