export type MintQuotePayloadState = "UNPAID" | "PAID" | "ISSUED" | "PENDING";

export interface MintQuotePayload {
  quote: string;
  request: string;
  state: MintQuotePayloadState;
  expiry: number;
}

export type QuoteCheckResult =
  | { kind: "found"; payload: MintQuotePayload }
  | { kind: "not_found" }
  | { kind: "mint_unavailable"; cause: unknown }
  | { kind: "invalid_response"; cause: unknown };

export interface MintQuoteClient {
  checkQuote(
    mintUrl: string,
    quoteId: string,
    signal?: AbortSignal,
  ): Promise<QuoteCheckResult>;
}

interface FetchMintQuoteClientOptions {
  fetch?: FetchLike;
  timeoutMs?: number;
}

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const PAYLOAD_STATES = new Set<MintQuotePayloadState>([
  "UNPAID",
  "PAID",
  "ISSUED",
  "PENDING",
]);

export function isMintQuotePayload(value: unknown): value is MintQuotePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.quote === "string" &&
    typeof payload.request === "string" &&
    typeof payload.expiry === "number" &&
    Number.isFinite(payload.expiry) &&
    typeof payload.state === "string" &&
    PAYLOAD_STATES.has(payload.state as MintQuotePayloadState)
  );
}

export class FetchMintQuoteClient implements MintQuoteClient {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: FetchMintQuoteClientOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async checkQuote(
    mintUrl: string,
    quoteId: string,
    signal?: AbortSignal,
  ): Promise<QuoteCheckResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) {
      abortFromCaller();
    } else {
      signal?.addEventListener("abort", abortFromCaller, { once: true });
    }

    try {
      const response = await this.fetchImpl(
        this.buildQuoteUrl(mintUrl, quoteId),
        {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );
      const body = await response.text();

      if (response.status >= 500) {
        return {
          kind: "mint_unavailable",
          cause: new Error(`Mint returned HTTP ${response.status}`),
        };
      }
      if (response.status === 404 || this.isQuoteNotFound(body)) {
        return { kind: "not_found" };
      }
      if (!response.ok) {
        return {
          kind: "invalid_response",
          cause: new Error(`Mint returned HTTP ${response.status}`),
        };
      }

      let data: unknown;
      try {
        data = JSON.parse(body);
      } catch (cause) {
        return { kind: "invalid_response", cause };
      }

      if (!isMintQuotePayload(data)) {
        return {
          kind: "invalid_response",
          cause: new Error("Mint quote response did not match the expected shape"),
        };
      }
      return { kind: "found", payload: data };
    } catch (cause) {
      return { kind: "mint_unavailable", cause };
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  private buildQuoteUrl(mintUrl: string, quoteId: string): string {
    const base = mintUrl.endsWith("/") ? mintUrl.slice(0, -1) : mintUrl;
    return `${base}/v1/mint/quote/bolt11/${encodeURIComponent(quoteId)}`;
  }

  private isQuoteNotFound(body: string): boolean {
    return /quote[^\n]*not found|not found[^\n]*quote/i.test(body);
  }
}
