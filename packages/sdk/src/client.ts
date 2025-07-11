import type {
  ErrorResponse,
  QuotesResponse,
  UserResponse,
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

  async authenticatedRequest<T extends ApiReponses>(
    path: string,
    opts: RequestInit,
  ) {
    const url = `${this._baseUrl}${path}`;
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
