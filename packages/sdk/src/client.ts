import type {
  ErrorResponse,
  QuotesResponse,
  UserResponse,
  Quote,
} from "npubcash-types";

import { SettingsManager } from "./settings";
import { type Logger, NullLogger } from "./logger"; // Import Logger and NullLogger

export interface AuthProvider {
  getAuthToken(url: string, method: string): Promise<string>;
}

// Define specific API response types for better type safety
type ApiResponse = QuotesResponse | UserResponse;

// Custom error for API responses
export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = status || 500;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

export class NPCClient {
  private readonly _baseUrl: string;
  private readonly authProvider: AuthProvider;
  public readonly settings: SettingsManager;
  private logger: Logger; // Add logger property

  constructor(baseUrl: string, authProvider: AuthProvider) {
    this._baseUrl = baseUrl;
    this.authProvider = authProvider;
    this.settings = new SettingsManager(this._authenticatedRequest.bind(this));
    this.logger = new NullLogger(); // Initialize with NullLogger by default
  }

  public setLogger(logger: Logger): void {
    this.logger = logger;
  }

  async getQuotesSince(since: number): Promise<Quote[]> {
    this.logger.debug(`Fetching quotes since: ${since}`);
    let allQuotes: Quote[] = [];
    let offset = 0;
    const limit = 50;

    while (true) {
      const data = await this._authenticatedRequest<QuotesResponse>(
        "/api/v2/wallet/quotes",
        {
          params: {
            since: since,
            offset: offset,
            limit: limit,
          },
        },
      );

      allQuotes = allQuotes.concat(data.data.quotes);
      this.logger.debug(
        `Fetched ${data.data.quotes.length} quotes. Total fetched: ${allQuotes.length}`,
      );

      if (offset + limit >= data.metadata.total) {
        break;
      }
      offset += limit;
    }
    this.logger.info(`Successfully fetched ${allQuotes.length} quotes.`);
    return allQuotes;
  }

  private async _authenticatedRequest<T extends ApiResponse>(
    path: string,
    options: RequestOptions = {},
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
        options.method || "GET",
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
        this.logger.error(`API Error: ${errorData.message || res.statusText}`, {
          status: res.status,
          url: url.toString(),
        });
        throw new ApiError(errorData.message || res.statusText, res.status);
      }

      const responseData = (await res.json()) as T;
      this.logger.debug("Request successful", { url: url.toString() });
      return responseData;
    } catch (error) {
      this.logger.error("Authenticated request failed:", error);
      throw error;
    }
  }
}
