import type {
  ErrorResponse,
  QuotesResponse,
  UserResponse,
  Quote,
} from "npubcash-types";

interface AuthProvider {
  getAuthToken(url: string): Promise<string>;
}

// Define specific API response types for better type safety
type ApiResponse = QuotesResponse | UserResponse;

// Custom error for API responses
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

export class NPCClient {
  private readonly _baseUrl: string;
  private readonly authProvider: AuthProvider;

  constructor(baseUrl: string, authProvider: AuthProvider) {
    this._baseUrl = baseUrl;
    this.authProvider = authProvider;
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

    const authToken = await this.authProvider.getAuthToken(url.toString());

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
