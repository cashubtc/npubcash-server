import type { RequestRateLimiterOptions } from "../../infrastructure/RequestRateLimiter";
import {
  PerMintRequestBudget,
  type MintRequestBudget,
} from "../../infrastructure/MintRequestBudget";
import {
  BudgetedMintRequestExecutor,
  type MintRequestExecutor,
} from "../../infrastructure/MintRequestExecutor";

export type MintQuotePayloadState = "UNPAID" | "PAID" | "ISSUED" | "PENDING";

export interface MintQuotePayload {
  quote: string;
  request: string;
  state: MintQuotePayloadState;
  expiry?: number | null;
  updated_at?: number;
}

export type QuoteCheckResult =
  | {
      kind: "found";
      payload: MintQuotePayload;
      requestStartedAt: Date;
    }
  | { kind: "not_found"; requestStartedAt: Date }
  | { kind: "mint_unavailable"; cause: unknown }
  | { kind: "invalid_response"; cause: unknown };

export interface MintQuoteCheck {
  payload: MintQuotePayload;
  requestStartedAt: Date;
}

export type BatchQuoteCheckResult =
  | { kind: "found"; checks: MintQuoteCheck[] }
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
    batchSize: number,
    signal?: AbortSignal,
  ): Promise<BatchQuoteCheckResult>;
}

interface FetchMintQuoteClientOptions {
  fetch?: FetchLike;
  now?: () => Date;
  timeoutMs?: number;
  rateLimit?: RequestRateLimiterOptions;
  requestBudget?: MintRequestBudget;
  requestExecutor?: MintRequestExecutor;
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

const MAX_LOGGED_RESPONSE_BODY_LENGTH = 2_000;

function mintResponseError(
  message: string,
  response: Response,
  body: string,
  cause?: unknown,
): Error {
  const truncated = body.length > MAX_LOGGED_RESPONSE_BODY_LENGTH;
  const bodyPreview = truncated
    ? `${body.slice(0, MAX_LOGGED_RESPONSE_BODY_LENGTH)}…`
    : body;
  const status = response.statusText
    ? `${response.status} ${response.statusText}`
    : String(response.status);
  const causeMessage =
    cause instanceof Error
      ? `; cause: ${cause.message}`
      : cause === undefined
        ? ""
        : `; cause: ${String(cause)}`;
  const truncationNotice = truncated
    ? ` (truncated from ${body.length} characters)`
    : "";

  return new Error(
    `${message}; HTTP ${status}; response body: ${bodyPreview}${truncationNotice}${causeMessage}`,
  );
}

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
  private readonly now: () => Date;
  private readonly requestExecutor: MintRequestExecutor;

  constructor(options: FetchMintQuoteClientOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.requestExecutor =
      options.requestExecutor ??
      new BudgetedMintRequestExecutor({
        requestBudget:
          options.requestBudget ?? new PerMintRequestBudget(options.rateLimit),
        timeoutMs: options.timeoutMs,
      });
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
          const requestStartedAt = this.now();
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
              cause: mintResponseError("Mint request failed", response, body),
            };
          }
          if (response.status === 400 && this.isQuoteNotFound(body)) {
            return { kind: "not_found", requestStartedAt };
          }
          if (!response.ok) {
            return {
              kind: "invalid_response",
              cause: mintResponseError("Mint request failed", response, body),
            };
          }

          let data: unknown;
          try {
            data = JSON.parse(body);
          } catch (cause) {
            return {
              kind: "invalid_response",
              cause: mintResponseError(
                "Mint quote response was not valid JSON",
                response,
                body,
                cause,
              ),
            };
          }

          if (!isMintQuotePayload(data)) {
            return {
              kind: "invalid_response",
              cause: mintResponseError(
                "Mint quote response did not match the expected shape",
                response,
                body,
              ),
            };
          }
          return { kind: "found", payload: data, requestStartedAt };
        },
      );
    } catch (cause) {
      return { kind: "mint_unavailable", cause };
    }
  }

  async checkQuotes(
    mintUrl: string,
    quoteIds: readonly string[],
    batchSize: number,
    signal?: AbortSignal,
  ): Promise<BatchQuoteCheckResult> {
    if (quoteIds.length === 0) return { kind: "found", checks: [] };
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      return {
        kind: "invalid_response",
        cause: new RangeError("Batch size must be a positive integer"),
      };
    }
    if (new Set(quoteIds).size !== quoteIds.length) {
      return {
        kind: "invalid_response",
        cause: new Error("Batch quote IDs must be unique"),
      };
    }

    const checks: MintQuoteCheck[] = [];
    for (let offset = 0; offset < quoteIds.length; offset += batchSize) {
      const batch = quoteIds.slice(offset, offset + batchSize);
      let response: Response;
      let body: string;
      let requestStartedAt: Date;
      try {
        ({ response, body, requestStartedAt } = await this.withMintRequest(
          mintUrl,
          signal,
          async (requestSignal) => {
            const requestStartedAt = this.now();
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
            return {
              response,
              body: await response.text(),
              requestStartedAt,
            };
          },
        ));
      } catch (cause) {
        return { kind: "mint_unavailable", cause };
      }

      if (response.status === 429 || response.status >= 500) {
        return {
          kind: "mint_unavailable",
          cause: mintResponseError("Mint batch request failed", response, body),
        };
      }
      if (!response.ok) {
        return {
          kind: "invalid_response",
          cause: mintResponseError("Mint batch request failed", response, body),
        };
      }

      let data: unknown;
      try {
        data = JSON.parse(body);
      } catch (cause) {
        return {
          kind: "invalid_response",
          cause: mintResponseError(
            "Mint batch response was not valid JSON",
            response,
            body,
            cause,
          ),
        };
      }
      if (!Array.isArray(data) || data.length !== batch.length) {
        return {
          kind: "invalid_response",
          cause: mintResponseError(
            "Mint batch quote response length did not match request",
            response,
            body,
          ),
        };
      }
      for (let index = 0; index < data.length; index += 1) {
        const payload = data[index];
        if (!isMintQuotePayload(payload) || payload.quote !== batch[index]) {
          return {
            kind: "invalid_response",
            cause: mintResponseError(
              "Mint batch quote response did not match the requested order",
              response,
              body,
            ),
          };
        }
        checks.push({ payload, requestStartedAt });
      }
    }
    return { kind: "found", checks };
  }

  private async withMintRequest<T>(
    mintUrl: string,
    signal: AbortSignal | undefined,
    request: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    return this.requestExecutor.run(mintUrl, signal, request);
  }

  private buildQuoteUrl(mintUrl: string, quoteId: string): string {
    const base = this.normalizeBaseUrl(mintUrl);
    return `${base}/v1/mint/quote/bolt11/${encodeURIComponent(quoteId)}`;
  }

  private buildBatchQuoteUrl(mintUrl: string): string {
    return `${this.normalizeBaseUrl(mintUrl)}/v1/mint/quote/bolt11/check`;
  }

  private normalizeBaseUrl(mintUrl: string): string {
    return mintUrl.endsWith("/") ? mintUrl.slice(0, -1) : mintUrl;
  }

  private isQuoteNotFound(body: string): boolean {
    return /quote[^\n]*not found|not found[^\n]*quote/i.test(body);
  }
}
