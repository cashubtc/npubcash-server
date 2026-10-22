import { CashuMint, type GetInfoResponse } from "@cashu/cashu-ts";
import { MintRepository } from "./MintRepository";
import { Mint } from "./Mint";
import { BadRequestError } from "@/errors";
import { logger } from "@/utils/logger";

export type QuoteBatchingSupport =
  { support: false } | { support: true; limit: number };

export interface MintInfoLoader {
  getMintInfo(mintUrl: string, signal?: AbortSignal): Promise<GetInfoResponse>;
}

export interface MintServiceOptions {
  mintInfoLoader?: MintInfoLoader;
}

const cashuMintInfoLoader: MintInfoLoader = {
  getMintInfo: async (mintUrl) => new CashuMint(mintUrl).getInfo(),
};

export class MintService {
  private readonly repo: MintRepository;
  private readonly mintInfoLoader: MintInfoLoader;

  constructor(repo: MintRepository, options: MintServiceOptions = {}) {
    this.repo = repo;
    this.mintInfoLoader = options.mintInfoLoader ?? cashuMintInfoLoader;
  }

  async checkMintUrl(
    mintUrl: string,
    shouldLock: boolean,
    signal?: AbortSignal,
  ) {
    let mint = await this.repo.getMint(mintUrl);
    if (!mint) {
      try {
        const info = await this.mintInfoLoader.getMintInfo(mintUrl, signal);
        this.throwIfAborted(signal);
        mint = new Mint({ url: mintUrl, lastChecked: new Date(), info });
      } catch (cause) {
        if (signal?.aborted) throw signal.reason ?? cause;
        throw new BadRequestError(
          "Could not get mint info. Is this a valid mint url?",
        );
      }
      await this.repo.saveMint(mint);
    }
    if (mint) {
      await this.ensureLatestMintInfo(mint, signal);
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
    signal?: AbortSignal,
  ): Promise<QuoteBatchingSupport> {
    const mint = await this.checkMintUrl(mintUrl, false, signal);
    const nut29 = (mint.info.nuts as Record<string, unknown>)["29"];
    if (!nut29 || typeof nut29 !== "object") {
      return { support: false };
    }

    const advertisement = nut29 as Record<string, unknown>;
    if (
      advertisement.methods !== undefined &&
      (!Array.isArray(advertisement.methods) ||
        !advertisement.methods.includes("bolt11"))
    ) {
      return { support: false };
    }

    const advertisedLimit = advertisement.max_batch_size;
    return {
      support: true,
      limit:
        typeof advertisedLimit === "number" &&
        Number.isInteger(advertisedLimit) &&
        advertisedLimit > 0
          ? advertisedLimit
          : 100,
    };
  }

  async ensureLatestMintInfo(mint: Mint, signal?: AbortSignal) {
    if (mint.infoExpired()) {
      logger.info(
        `Local mint info for ${mint.url} expired. Fetching new one...`,
      );
      await this.updateMintInfo(mint, signal);
    }
  }

  async updateMintInfo(mint: Mint, signal?: AbortSignal) {
    const info = await this.mintInfoLoader.getMintInfo(mint.url, signal);
    this.throwIfAborted(signal);
    mint.updateInfo(info);
    await this.repo.saveMint(mint);
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw signal.reason ?? new Error("Mint info request aborted");
    }
  }
}
