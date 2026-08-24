import { createCashuMintRequest } from "@/infrastructure/CashuMintRequest";
import type { MintRequestExecutor } from "@/infrastructure/MintRequestExecutor";
import { normalizeUrl } from "@/utils/utils";
import { CashuMint, CashuWallet } from "@cashu/cashu-ts";
import type { CommunicatorWalletFactory } from "./CommunicatorService";

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface CashuWalletFactoryOptions {
  requestExecutor: MintRequestExecutor;
  fetch?: FetchLike;
}

export function createCashuWalletFactory(
  options: CashuWalletFactoryOptions,
): CommunicatorWalletFactory {
  return (mintUrl) => {
    const normalizedMintUrl = normalizeUrl(mintUrl);
    const request = createCashuMintRequest({
      mintUrl: normalizedMintUrl,
      requestExecutor: options.requestExecutor,
      fetch: options.fetch,
    });
    return new CashuWallet(new CashuMint(normalizedMintUrl, request));
  };
}
