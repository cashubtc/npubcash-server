import type { Logger } from "winston";
import type { MintAdapter as IMintAdapter, MintQuotePayload } from "./types";

export class MintAdapter implements IMintAdapter {
  private readonly logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  async checkMintQuoteState(
    mintUrl: string,
    quoteId: string,
  ): Promise<MintQuotePayload> {
    const url = this.buildQuoteUrl(mintUrl, quoteId);
    this.logger?.debug("[Polling] Checking mint quote state", { transport: "polling", mintUrl, quoteId });

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      this.logger?.error("[Polling] Failed to check mint quote state", {
        transport: "polling",
        mintUrl,
        quoteId,
        status: response.status,
        error: errorText,
      });
      throw new Error(
        `Failed to check quote state: ${response.status} ${errorText}`,
      );
    }

    const data = (await response.json()) as MintQuotePayload;
    this.logger?.debug("[Polling] Mint quote state retrieved", {
      transport: "polling",
      mintUrl,
      quoteId,
      state: data.state,
    });
    return data;
  }

  private buildQuoteUrl(mintUrl: string, quoteId: string): string {
    const base = mintUrl.endsWith("/") ? mintUrl.slice(0, -1) : mintUrl;
    return `${base}/v1/mint/quote/bolt11/${quoteId}`;
  }
}
