import { normalizeUrl } from "@/utils/utils";
import {
  RequestRateLimiter,
  type RequestRateLimiterOptions,
} from "./RequestRateLimiter";

export interface MintRequestBudget {
  schedule<T>(
    mintUrl: string,
    request: () => Promise<T> | T,
    signal?: AbortSignal,
  ): Promise<T>;
}

/** Shares one token bucket across all request transports for each mint. */
export class PerMintRequestBudget implements MintRequestBudget {
  private readonly options: RequestRateLimiterOptions;
  private readonly limiters = new Map<string, RequestRateLimiter>();

  constructor(options: RequestRateLimiterOptions = {}) {
    this.options = { ...options };
  }

  schedule<T>(
    mintUrl: string,
    request: () => Promise<T> | T,
    signal?: AbortSignal,
  ): Promise<T> {
    const key = normalizeUrl(mintUrl);
    let limiter = this.limiters.get(key);
    if (!limiter) {
      limiter = new RequestRateLimiter(this.options);
      this.limiters.set(key, limiter);
    }
    return limiter.schedule(request, signal);
  }
}
