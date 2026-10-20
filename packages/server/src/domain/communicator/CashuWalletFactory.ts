import { createCashuMintRequest } from "@/infrastructure/CashuMintRequest";
import type { MintRequestExecutor } from "@/infrastructure/MintRequestExecutor";
import { normalizeUrl } from "@/utils/utils";
import { Mint, Wallet } from "@cashu/cashu-ts";
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
    const wallet = new Wallet(
      new Mint(normalizedMintUrl, { customRequest: request }),
    );
    // cashu-ts v3 keeps no state about the mint until loadMint() runs: quotes read
    // mint info and V4 token swaps need the keyset keys before the wallet is usable.
    let mintLoad: Promise<void> | undefined;
    const ensureMint = () => (mintLoad ??= wallet.loadMint());

    return {
      receive: async (token) => {
        await ensureMint();
        return wallet.receive(token);
      },
      createMintQuote: async (amount) => {
        await ensureMint();
        return wallet.createMintQuote(amount);
      },
      createLockedMintQuote: async (amount, publicKey) => {
        await ensureMint();
        return wallet.createLockedMintQuote(amount, publicKey);
      },
    };
  };
}
