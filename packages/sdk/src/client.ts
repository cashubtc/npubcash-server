import type { ErrorResponse, QuotesResponse, Quote } from "npubcash-types";

import { SettingsManager } from "./settings";
import { type Logger, NullLogger } from "./logger";
import {
  ApiError,
  type ApiResponse,
  type AuthProvider,
  type RequestOptions,
} from "./types";
import { SubscriptionManager } from "./subscriber";

const API_PATHS = {
  QUOTES: "/api/v2/wallet/quotes",
};
const PAGINATION_LIMIT = 50;
const THROTTLE_DELAY_MS = 200;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * High‑level client for the NpubCash HTTP and realtime APIs.
 *
 * - HTTP requests are authenticated via {@link AuthProvider.getAuthToken}
 * - WebSocket auth uses NIP‑98 via {@link AuthProvider.getNostrToken}
 *
 * @example
 * const baseUrl = "https://npubx.cash";
 * const signer = (tpl) => window.nostr!.signEvent(tpl);
 * const client = new NPCClient(baseUrl, new JWTAuthProvider(baseUrl, signer));
 * const quotes = await client.getAllQuotes();
 */
export class NPCClient {
  private readonly _baseUrl: string;
  private readonly authProvider: AuthProvider;
  /**
   * Settings API for the authenticated user account.
   * Use {@link SettingsManager.setMintUrl} and {@link SettingsManager.setLock}.
   */
  public readonly settings: SettingsManager;
  private logger: Logger;

  /**
   * Create a client.
   * @param baseUrl Base URL of the NpubCash server, e.g. `https://npubx.cash`.
   * @param authProvider Provider that supplies HTTP and NIP‑98 auth tokens.
   */
  constructor(baseUrl: string, authProvider: AuthProvider) {
    this._baseUrl = baseUrl;
    this.authProvider = authProvider;
    this.settings = new SettingsManager(this._authenticatedRequest.bind(this));
    this.logger = new NullLogger();
  }

  /**
   * Set a logger implementation for SDK diagnostics.
   * @param logger Logger implementation to use (e.g., {@link ConsoleLogger}).
   */
  public setLogger(logger: Logger): void {
    this.logger = logger;
    this.settings.setLogger(logger);
  }

  /**
   * Fetch quotes created since a UNIX timestamp (in seconds).
   * Handles pagination internally.
   * @param since UNIX timestamp in seconds.
   * @returns All quotes since the given time.
   */
  public async getQuotesSince(since: number): Promise<Quote[]> {
    this.logger.debug(`Fetching quotes since timestamp: ${since}`);
    return this._fetchPaginatedQuotes(since);
  }

  /**
   * Fetch all quotes for the authenticated user.
   * Handles pagination internally.
   * @returns All available quotes.
   */
  public async getAllQuotes(): Promise<Quote[]> {
    this.logger.debug("Fetching all quotes.");
    return this._fetchPaginatedQuotes();
  }

  /**
   * Subscribe to realtime quote update notifications.
   *
   * Opens a WebSocket to `${baseUrl}/api/v2/ws/quote` and authenticates via NIP‑98
   * challenge/response. The callback receives the updated `quoteId`.
   *
   * @param onUpdate Called whenever a quote is updated.
   * @param onError Optional callback for WebSocket/auth errors. Receives a message.
   * @returns Disposer function to close the subscription.
   */
  public subscribe(
    onUpdate: (quoteId: string) => void,
    onError?: (msg: string) => void
  ) {
    const url = new URL(`${this._baseUrl}/api/v2/ws/quote`);
    const wsUrl = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}${
      url.pathname
    }`;
    const manager = new SubscriptionManager(
      wsUrl,
      this.authProvider,
      onUpdate,
      this.logger,
      onError
    );
    return () => manager.dispose();
  }

  private async _fetchPaginatedQuotes(since?: number): Promise<Quote[]> {
    let allQuotes: Quote[] = [];
    let offset = 0;

    while (true) {
      const requestParams: Record<string, number> = {
        offset,
        limit: PAGINATION_LIMIT,
      };
      if (since) {
        requestParams.since = since;
      }

      const data = await this._authenticatedRequest<QuotesResponse>(
        API_PATHS.QUOTES,
        { params: requestParams }
      );

      const fetchedQuotes = data.data.quotes;
      allQuotes = allQuotes.concat(fetchedQuotes);
      this.logger.debug(
        `Fetched ${fetchedQuotes.length} quotes. Total fetched: ${allQuotes.length}`
      );

      const totalAvailable = data.metadata.total;
      offset += PAGINATION_LIMIT;

      if (offset >= totalAvailable) {
        break;
      }

      this.logger.debug(`Throttling for ${THROTTLE_DELAY_MS}ms...`);
      await delay(THROTTLE_DELAY_MS);
    }

    this.logger.info(
      `Successfully fetched a total of ${allQuotes.length} quotes.`
    );
    return allQuotes;
  }

  private async _authenticatedRequest<T extends ApiResponse>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = new URL(`${this._baseUrl}${path}`);

    if (options.params) {
      for (const key in options.params) {
        if (Object.prototype.hasOwnProperty.call(options.params, key)) {
          url.searchParams.append(key, String(options.params[key]));
        }
      }
    }

    try {
      const urlForAuth = `${url.protocol}//${url.host}${url.pathname}`;
      const authToken = await this.authProvider.getAuthToken(
        urlForAuth,
        options.method || "GET"
      );
      this.logger.debug(`Auth token obtained for URL: ${urlForAuth}`);

      const res = await fetch(url.toString(), {
        ...options,
        headers: {
          ...options.headers,
          Authorization: authToken,
        },
      });

      if (!res.ok) {
        const errorData: ErrorResponse = await res.json();
        const errorMessage = errorData.message || res.statusText;
        this.logger.error(`API Error: ${errorMessage}`, {
          status: res.status,
          url: url.toString(),
        });
        throw new ApiError(errorMessage, res.status);
      }

      const responseData = (await res.json()) as T;
      this.logger.debug("Request successful", { url: url.toString() });
      return responseData;
    } catch (error) {
      if (!(error instanceof ApiError)) {
        this.logger.error("Authenticated request failed unexpectedly:", error);
      }
      throw error;
    }
  }
}
