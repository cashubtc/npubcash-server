import { getToken } from "nostr-tools/nip98";
import { authenticatedRequest } from "./utils/request";
import type { Logger } from "./logger";
import type { Nip98Response } from "npubcash-types";
import type { SigningFunc } from "./types";

export class JWTAuthProvider {
  private storedToken?: { token: string; expiresAt: Date };
  private signer: SigningFunc;
  private readonly _baseUrl: string;
  private readonly logger?: Logger;

  constructor(baseUrl: string, signer: SigningFunc, logger?: Logger) {
    this._baseUrl = baseUrl;
    this.signer = signer;
    this.logger = logger;
  }

  async getAuthToken(url: string, method: string) {
    this.logger?.debug(
      `Provider getting token for URL: ${url} - METHOD: ${method}`,
    );
    // Pass only required parameters, or none if they are not used
    const token = await this._ensureCachedToken();
    return `Bearer ${token}`;
  }

  async getNostrToken(url: string, method: string) {
    return getToken(url, method, this.signer);
  }

  private async _ensureCachedToken(): Promise<string> {
    if (this.storedToken && this.storedToken.expiresAt > new Date()) {
      this.logger?.debug("Returning cached token.");
      return this.storedToken.token;
    }

    this.logger?.debug("No valid cached token found, fetching a new one.");

    const authUrl = `${this._baseUrl}/api/v2/auth/nip98`;
    const nostrToken = await getToken(authUrl, "GET", async (t) => {
      const signed = await this.signer(t);
      return signed;
    });

    const res = await authenticatedRequest<Nip98Response>(
      authUrl,
      `Nostr ${nostrToken}`,
      undefined,
      this.logger,
    );

    // Assuming the response structure has `res.data.token`
    const token = res.data.token;
    if (typeof token !== "string") {
      this.logger?.error("Token received from auth endpoint is invalid.");
      throw new Error("Received invalid token from authentication endpoint.");
    }

    this.storedToken = {
      token,
      expiresAt: new Date(new Date().getTime() + 5 * 60 * 1000),
    };
    this.logger?.info("Successfully fetched and cached new token.");
    return token;
  }
}
