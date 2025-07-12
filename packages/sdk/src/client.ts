import type {
  ErrorResponse,
  QuotesResponse,
  UserResponse,
  Quote,
} from "npubcash-types";

interface AuthProvider {
  getAuthToken(url: string): Promise<string>;
}

type ApiReponses = QuotesResponse | UserResponse;

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

  private _buildUrlWithQueryParams(
    baseUrl: string,
    params?: Record<string, string | number | boolean>,
  ): string {
    let url = baseUrl;
    if (params) {
      const query = new URLSearchParams();
      for (const key in params) {
        if (params.hasOwnProperty(key)) {
          query.append(key, String(params[key]));
        }
      }
      url = `${url}?${query.toString()}`;
    }
    return url;
  }

  private async _authenticatedRequest<T extends ApiReponses>(
    path: string,
    opts: RequestInit & { params?: Record<string, string | number | boolean> },
  ) {
    const url = this._buildUrlWithQueryParams(
      `${this._baseUrl}${path}`,
      opts.params,
    );

    const authToken = await this.authProvider.getAuthToken(url);
    const res = await fetch(url, {
      ...opts,
      headers: { ...opts.headers, Authorization: authToken },
    });
    const data = (await res.json()) as T | ErrorResponse;
    if (data.error) {
      throw new Error(data.message);
    }
    return data;
  }
}
