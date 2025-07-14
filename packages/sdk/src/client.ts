import type {
  ErrorResponse,
  QuotesResponse,
  UserResponse,
  Quote,
} from "npubcash-types";
import { SettingsManager } from "./settings";

export interface AuthProvider {
  getAuthToken(url: string, method: string): Promise<string>;
}

type ApiResponse = QuotesResponse | UserResponse;

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
  public readonly settings: SettingsManager; // Add SettingsManager instance

  constructor(baseUrl: string, authProvider: AuthProvider) {
    this._baseUrl = baseUrl;
    this.authProvider = authProvider;
    this.settings = new SettingsManager(this._authenticatedRequest.bind(this));
  }

  async getQuotesSince(since: number): Promise<Quote[]> {
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

      if (offset + limit >= data.metadata.total) {
        break;
      }
      offset += limit;
    }
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

    const authToken = await this.authProvider.getAuthToken(
      url.toString(),
      options.method || "GET",
    );

    const res = await fetch(url.toString(), {
      ...options,
      headers: {
        ...options.headers,
        Authorization: authToken,
      },
    });

    if (!res.ok) {
      const errorData: ErrorResponse = await res.json();
      throw new ApiError(errorData.message || res.statusText, res.status);
    }

    // Ensure the response is of the expected type T
    return (await res.json()) as T;
  }
}
