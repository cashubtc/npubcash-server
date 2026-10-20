import type { MintInfoLoader } from "@/domain/mint/MintService";
import type { MintRequestExecutor } from "@/infrastructure/MintRequestExecutor";
import { normalizeUrl } from "@/utils/utils";
import type { GetInfoResponse } from "@cashu/cashu-ts";

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface FetchMintInfoLoaderOptions {
  requestExecutor: MintRequestExecutor;
  fetch?: FetchLike;
}

export class FetchMintInfoLoader implements MintInfoLoader {
  private readonly requestExecutor: MintRequestExecutor;
  private readonly fetchImpl: FetchLike;

  constructor(options: FetchMintInfoLoaderOptions) {
    this.requestExecutor = options.requestExecutor;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async getMintInfo(
    mintUrl: string,
    signal?: AbortSignal,
  ): Promise<GetInfoResponse> {
    return this.requestExecutor.run(mintUrl, signal, async (requestSignal) => {
      const response = await this.fetchImpl(
        `${normalizeUrl(mintUrl)}/v1/info`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: requestSignal,
        },
      );
      const body = await response.text();
      if (!response.ok) {
        throw new Error(
          `Mint info request failed with HTTP ${response.status}: ${body}`,
        );
      }

      let info: unknown;
      try {
        info = JSON.parse(body);
      } catch (cause) {
        throw new Error("Mint info response was not valid JSON", {
          cause,
        });
      }
      if (!info || typeof info !== "object") {
        throw new Error("Mint info response did not match the expected shape");
      }
      const nuts = (info as Record<string, unknown>).nuts;
      if (!nuts || typeof nuts !== "object") {
        throw new Error("Mint info response did not include NUT capabilities");
      }
      return info as GetInfoResponse;
    });
  }
}
