import { normalizeUrl } from "@/utils/utils";
import { Token } from "@cashu/cashu-ts";
import { MintCommunicator } from "almnd";
import type { Logger } from "winston";

export class CommunicatorService {
  private readonly communicators: { [mintUrl: string]: MintCommunicator } = {};

  async redeemToken(token: Token, logger?: Logger) {
    logger?.info(`Receiving proofs on mint ${token.mint}`);
    return this.getCommunicator(token.mint).receive(token);
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
