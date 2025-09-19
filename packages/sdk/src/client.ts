import type {
  ErrorResponse,
  QuotesResponse,
  UserResponse,
  Quote,
} from "npubcash-types";

import { SettingsManager } from "./settings";
import { type Logger, NullLogger } from "./logger";
import { ApiError } from "./types";
import { SubscriptionManager } from "./subscriber";

const API_PATHS = {
  QUOTES: "/api/v2/wallet/quotes",
};
const PAGINATION_LIMIT = 50;
const THROTTLE_DELAY_MS = 200;

export interface AuthProvider {
  getAuthToken(url: string, method: string): Promise<string>;
  getNostrToken(url: string, method: string): Promise<string>;
}

type ApiResponse = QuotesResponse | UserResponse;

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class NPCClient {
  private readonly _baseUrl: string;
  private readonly authProvider: AuthProvider;
  public readonly settings: SettingsManager;
  private logger: Logger;

  constructor(baseUrl: string, authProvider: AuthProvider) {
    this._baseUrl = baseUrl;
    this.authProvider = authProvider;
    this.settings = new SettingsManager(this._authenticatedRequest.bind(this));
    this.logger = new NullLogger();
  }

  public setLogger(logger: Logger): void {
    this.logger = logger;
  }

  public async getQuotesSince(since: number): Promise<Quote[]> {
    this.logger.debug(`Fetching quotes since timestamp: ${since}`);
    return this._fetchPaginatedQuotes(since);
  }

  public async getAllQuotes(): Promise<Quote[]> {
    this.logger.debug("Fetching all quotes.");
    return this._fetchPaginatedQuotes();
  }

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
