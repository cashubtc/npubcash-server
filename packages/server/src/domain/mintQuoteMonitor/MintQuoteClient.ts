import type { RequestRateLimiterOptions } from "../../infrastructure/RequestRateLimiter";
import {
  PerMintRequestBudget,
  type MintRequestBudget,
} from "../../infrastructure/MintRequestBudget";

export type MintQuotePayloadState = "UNPAID" | "PAID" | "ISSUED" | "PENDING";

export interface MintQuotePayload {
  quote: string;
  request: string;
  state: MintQuotePayloadState;
  expiry?: number | null;
  updated_at?: number;
}

export type QuoteCheckResult =
  | { kind: "found"; payload: MintQuotePayload }
  | { kind: "not_found" }
  | { kind: "mint_unavailable"; cause: unknown }
  | { kind: "invalid_response"; cause: unknown };

export type BatchQuoteCheckResult =
  | { kind: "found"; payloads: MintQuotePayload[] }
  | { kind: "unsupported" }
  | { kind: "mint_unavailable"; cause: unknown }
  | { kind: "invalid_response"; cause: unknown };

export interface MintQuoteClient {
  checkQuote(
    mintUrl: string,
    quoteId: string,
    signal?: AbortSignal,
  ): Promise<QuoteCheckResult>;
  checkQuotes(
    mintUrl: string,
    quoteIds: readonly string[],
    signal?: AbortSignal,
  ): Promise<BatchQuoteCheckResult>;
}

interface FetchMintQuoteClientOptions {
  fetch?: FetchLike;
  timeoutMs?: number;
  rateLimit?: RequestRateLimiterOptions;
  requestBudget?: MintRequestBudget;
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
    (payload.expiry === undefined ||
      payload.expiry === null ||
      (typeof payload.expiry === "number" &&
        Number.isFinite(payload.expiry))) &&
    (payload.updated_at === undefined ||
      (typeof payload.updated_at === "number" &&
        Number.isFinite(payload.updated_at))) &&
    typeof payload.state === "string" &&
    PAYLOAD_STATES.has(payload.state as MintQuotePayloadState)
  );
}

export class FetchMintQuoteClient implements MintQuoteClient {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly requestBudget: MintRequestBudget;

  constructor(options: FetchMintQuoteClientOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.requestBudget =
      options.requestBudget ?? new PerMintRequestBudget(options.rateLimit);
  }

  async checkQuote(
    mintUrl: string,
    quoteId: string,
    signal?: AbortSignal,
  ): Promise<QuoteCheckResult> {
    try {
      return await this.withMintRequest(
        mintUrl,
        signal,
        async (requestSignal) => {
          const response = await this.fetchImpl(
            this.buildQuoteUrl(mintUrl, quoteId),
            {
              method: "GET",
              headers: { Accept: "application/json" },
              signal: requestSignal,
            },
          );
          const body = await response.text();

          if (response.status === 429 || response.status >= 500) {
            return {
              kind: "mint_unavailable",
              cause: new Error(`Mint returned HTTP ${response.status}`),
            };
          }
          if (response.status === 400 && this.isQuoteNotFound(body)) {
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
              cause: new Error(
                "Mint quote response did not match the expected shape",
              ),
            };
          }
          return { kind: "found", payload: data };
        },
      );
    } catch (cause) {
      return { kind: "mint_unavailable", cause };
    }
  }

  async checkQuotes(
    mintUrl: string,
    quoteIds: readonly string[],
    signal?: AbortSignal,
  ): Promise<BatchQuoteCheckResult> {
    if (quoteIds.length === 0) return { kind: "found", payloads: [] };
    if (new Set(quoteIds).size !== quoteIds.length) {
      return {
        kind: "invalid_response",
        cause: new Error("Batch quote IDs must be unique"),
      };
    }

    const support = await this.getBatchSupport(mintUrl, signal);
    if (support.kind !== "supported") return support;

    const payloads: MintQuotePayload[] = [];
    const batchSize = support.maxBatchSize ?? quoteIds.length;
    for (let offset = 0; offset < quoteIds.length; offset += batchSize) {
      const batch = quoteIds.slice(offset, offset + batchSize);
      let response: Response;
      let body: string;
      try {
        ({ response, body } = await this.withMintRequest(
          mintUrl,
          signal,
          async (requestSignal) => {
            const response = await this.fetchImpl(
              this.buildBatchQuoteUrl(mintUrl),
              {
                method: "POST",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ quotes: batch }),
                signal: requestSignal,
              },
            );
            return { response, body: await response.text() };
          },
        ));
      } catch (cause) {
        return { kind: "mint_unavailable", cause };
      }

      if (response.status === 429 || response.status >= 500) {
        return {
          kind: "mint_unavailable",
          cause: new Error(`Mint returned HTTP ${response.status}`),
        };
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
      if (!Array.isArray(data) || data.length !== batch.length) {
        return {
          kind: "invalid_response",
          cause: new Error("Mint batch quote response length did not match request"),
        };
      }
      for (let index = 0; index < data.length; index += 1) {
        const payload = data[index];
        if (!isMintQuotePayload(payload) || payload.quote !== batch[index]) {
          return {
            kind: "invalid_response",
            cause: new Error(
              "Mint batch quote response did not match the requested order",
            ),
          };
        }
        payloads.push(payload);
      }
    }
    return { kind: "found", payloads };
  }

  private async getBatchSupport(
    mintUrl: string,
    signal?: AbortSignal,
  ): Promise<
    | { kind: "supported"; maxBatchSize?: number }
    | Exclude<BatchQuoteCheckResult, { kind: "found" }>
  > {
    let response: Response;
    let body: string;
    try {
      ({ response, body } = await this.withMintRequest(
        mintUrl,
        signal,
        async (requestSignal) => {
          const response = await this.fetchImpl(this.buildMintInfoUrl(mintUrl), {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: requestSignal,
          });
          return { response, body: await response.text() };
        },
      ));
    } catch (cause) {
      return { kind: "mint_unavailable", cause };
    }

    if (response.status === 429 || response.status >= 500) {
      return {
        kind: "mint_unavailable",
        cause: new Error(`Mint returned HTTP ${response.status}`),
      };
    }
    if (!response.ok) return { kind: "unsupported" };

    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch (cause) {
      return { kind: "invalid_response", cause };
    }
    if (!data || typeof data !== "object") return { kind: "unsupported" };
    const nuts = (data as Record<string, unknown>).nuts;
    if (!nuts || typeof nuts !== "object") return { kind: "unsupported" };
    const nut29 = (nuts as Record<string, unknown>)["29"];
    if (!nut29 || typeof nut29 !== "object") {
      return { kind: "unsupported" };
    }

    const advertisement = nut29 as Record<string, unknown>;
    if (
      advertisement.methods !== undefined &&
      (!Array.isArray(advertisement.methods) ||
        !advertisement.methods.includes("bolt11"))
    ) {
      return { kind: "unsupported" };
    }
    const advertisedMax = advertisement.max_batch_size;
    const maxBatchSize =
      typeof advertisedMax === "number" &&
      Number.isInteger(advertisedMax) &&
      advertisedMax > 0
        ? advertisedMax
        : undefined;
    return { kind: "supported", maxBatchSize };
  }

  private async withMintRequest<T>(
    mintUrl: string,
    signal: AbortSignal | undefined,
    request: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    return this.requestBudget.schedule(
      mintUrl,
      () => this.withRequestSignal(signal, request),
      signal,
    );
  }

  private async withRequestSignal<T>(
    signal: AbortSignal | undefined,
    request: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) {
      abortFromCaller();
    } else {
      signal?.addEventListener("abort", abortFromCaller, { once: true });
    }

    try {
      return await request(controller.signal);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  private buildQuoteUrl(mintUrl: string, quoteId: string): string {
    const base = this.normalizeBaseUrl(mintUrl);
    return `${base}/v1/mint/quote/bolt11/${encodeURIComponent(quoteId)}`;
  }

  private buildBatchQuoteUrl(mintUrl: string): string {
    return `${this.normalizeBaseUrl(mintUrl)}/v1/mint/quote/bolt11/check`;
  }

  private buildMintInfoUrl(mintUrl: string): string {
    return `${this.normalizeBaseUrl(mintUrl)}/v1/info`;
  }

  private normalizeBaseUrl(mintUrl: string): string {
    return mintUrl.endsWith("/") ? mintUrl.slice(0, -1) : mintUrl;
  }

  private isQuoteNotFound(body: string): boolean {
    return /quote[^\n]*not found|not found[^\n]*quote/i.test(body);
  }
}
