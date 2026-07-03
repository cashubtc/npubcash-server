import { Mint as CashuMint, MintInfo } from "@cashu/cashu-ts";
import { MintRepository } from "./MintRepository";
import { Mint } from "./Mint";
import { BadRequestError } from "@/errors";
import { logger } from "@/utils/logger";

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
