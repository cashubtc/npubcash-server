import { normalizeUrl } from "@/utils/utils";
import type { MintRequestBudget } from "@/infrastructure/MintRequestBudget";
import { CashuMint, CashuWallet, type Token } from "@cashu/cashu-ts";
import type { Logger } from "winston";

interface CommunicatorServiceOptions {
  requestBudget: MintRequestBudget;
}

export class CommunicatorService {
  private readonly requestBudget: MintRequestBudget;
  private readonly wallets = new Map<string, CashuWallet>();

  constructor(options: CommunicatorServiceOptions) {
    this.requestBudget = options.requestBudget;
  }

  async redeemToken(token: Token, logger?: Logger) {
    logger?.info(`Receiving proofs on mint ${token.mint}`);
    const normalizedMintUrl = normalizeUrl(token.mint);
    const wallet = this.getWallet(normalizedMintUrl);
    return this.requestBudget.schedule(normalizedMintUrl, () =>
      wallet.receive(token),
    );
  }

  async createMintQuote(
    amount: number,
    userData: { pubkey: string; lockQuote: boolean },
    mintUrl: string,
  ) {
    const normalizedMintUrl = normalizeUrl(mintUrl);
    const wallet = this.getWallet(normalizedMintUrl);
    if (userData.lockQuote) {
      const res = await this.requestBudget.schedule(normalizedMintUrl, () =>
        wallet.createLockedMintQuote(amount, `02${userData.pubkey}`),
      );
      return { locked: true, ...res };
    }
    const res = await this.requestBudget.schedule(normalizedMintUrl, () =>
      wallet.createMintQuote(amount),
    );
    return { locked: false, ...res };
  }

  private getWallet(mintUrl: string): CashuWallet {
    const normalizedMintUrl = normalizeUrl(mintUrl);
    let wallet = this.wallets.get(normalizedMintUrl);
    if (!wallet) {
      wallet = new CashuWallet(new CashuMint(normalizedMintUrl));
      this.wallets.set(normalizedMintUrl, wallet);
    }
    return wallet;
  }
}
