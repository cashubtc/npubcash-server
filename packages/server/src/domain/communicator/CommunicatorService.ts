import { normalizeUrl } from "@/utils/utils";
import type {
  LockedMintQuoteResponse,
  MintQuoteResponse,
  Proof,
  Token,
} from "@cashu/cashu-ts";
import type { Logger } from "winston";

interface CommunicatorServiceOptions {
  walletFactory: CommunicatorWalletFactory;
}

export interface CommunicatorWallet {
  receive(token: Token): Promise<Proof[]>;
  createMintQuote(amount: number): Promise<MintQuoteResponse>;
  createLockedMintQuote(
    amount: number,
    publicKey: string,
  ): Promise<LockedMintQuoteResponse>;
}

export type CommunicatorWalletFactory = (
  mintUrl: string,
) => CommunicatorWallet;

export class CommunicatorService {
  private readonly walletFactory: CommunicatorWalletFactory;
  private readonly wallets = new Map<string, CommunicatorWallet>();

  constructor(options: CommunicatorServiceOptions) {
    this.walletFactory = options.walletFactory;
  }

  async redeemToken(token: Token, logger?: Logger) {
    logger?.info(`Receiving proofs on mint ${token.mint}`);
    const normalizedMintUrl = normalizeUrl(token.mint);
    const wallet = this.getWallet(normalizedMintUrl);
    return wallet.receive(token);
  }

  async createMintQuote(
    amount: number,
    userData: { pubkey: string; lockQuote: boolean },
    mintUrl: string,
  ) {
    const normalizedMintUrl = normalizeUrl(mintUrl);
    const wallet = this.getWallet(normalizedMintUrl);
    if (userData.lockQuote) {
      const res = await wallet.createLockedMintQuote(
        amount,
        `02${userData.pubkey}`,
      );
      return { locked: true, ...res };
    }
    const res = await wallet.createMintQuote(amount);
    return { locked: false, ...res };
  }

  private getWallet(normalizedMintUrl: string): CommunicatorWallet {
    let wallet = this.wallets.get(normalizedMintUrl);
    if (!wallet) {
      wallet = this.walletFactory(normalizedMintUrl);
      this.wallets.set(normalizedMintUrl, wallet);
    }
    return wallet;
  }
}
