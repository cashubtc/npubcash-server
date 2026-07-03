import { Mint as CashuMint, MintInfo } from "@cashu/cashu-ts";
import { MintRepository } from "./MintRepository";
import { Mint } from "./Mint";
import { BadRequestError } from "@/errors";
import { logger } from "@/utils/logger";

export type QuoteBatchingSupport =
  | { support: false }
  | { support: true; limit: number };

export class MintService {
  private repo: MintRepository;

  constructor(repo: MintRepository) {
    this.repo = repo;
  }

  async checkMintUrl(mintUrl: string, shouldLock: boolean) {
    let mint = await this.repo.getMint(mintUrl);
    if (!mint) {
      const cashuMint = new CashuMint(mintUrl);
      try {
        const info = await cashuMint.getInfo() as unknown as MintInfo;
        mint = new Mint({ url: mintUrl, lastChecked: new Date(), info });
      } catch {
        throw new BadRequestError(
          "Could not get mint info. Is this a valid mint url?",
        );
      }
      await this.repo.saveMint(mint);
    }
    if (mint) {
      await this.ensureLatestMintInfo(mint);
      if (shouldLock && !mint.supportsLocking()) {
        throw new BadRequestError(
          "Mint does not support locking. Choose a different mint or disable locking",
        );
      }
    }
    return mint;
  }

  async getMint(mintUrl: string) {
    return this.repo.getMint(mintUrl);
  }

  async supportsQuoteBatching(
    mintUrl: string,
  ): Promise<QuoteBatchingSupport> {
    const mint = await this.checkMintUrl(mintUrl, false);
    const nut29 = (mint.info.nuts as Record<string, unknown>)["29"];
    if (!nut29 || typeof nut29 !== "object") {
      return { support: false };
    }

    const advertisedLimit = (nut29 as Record<string, unknown>).max_batch_size;
    return {
      support: true,
      limit:
        typeof advertisedLimit === "number" && advertisedLimit > 0
          ? advertisedLimit
          : 100,
    };
  }

  async ensureLatestMintInfo(mint: Mint) {
    if (mint.infoExpired()) {
      logger.info(
        `Local mint info for ${mint.url} expired. Fetching new one...`,
      );
      await this.updateMintInfo(mint);
    }
  }

  async updateMintInfo(mint: Mint) {
    const cashuMint = new CashuMint(mint.url);
    const info = await cashuMint.getInfo() as unknown as MintInfo;
    mint.updateInfo(info);
    await this.repo.saveMint(mint);
  }
}
