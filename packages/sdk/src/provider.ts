import { getToken } from "nostr-tools/nip98";
import { authenticatedRequest } from "./utils/request";
import type { Logger } from "./logger";
import type { Nip98Response } from "@npubcash/api-contract";
import type { SigningFunc } from "./types";

/**
 * Default authentication provider using NIP‑98 to fetch and cache short‑lived JWTs.
 *
 * Flow:
 * 1. Signs a NIP‑98 challenge against `GET {baseUrl}/api/v2/auth/nip98`
 * 2. Exchanges the NIP‑98 token for a short‑lived JWT (cached ~5 minutes)
 * 3. Provides `Bearer <jwt>` for HTTP and NIP‑98 tokens for WebSocket auth
 */
export class JWTAuthProvider {
  private storedToken?: { token: string; expiresAt: Date };
  private signer: SigningFunc;
  private readonly _baseUrl: string;
  private readonly logger?: Logger;

  /**
   * @param baseUrl Base URL of the NpubCash server (e.g., `https://npubx.cash`).
   * @param signer Function that signs a Nostr event template (NIP‑98).
   * @param logger Optional logger for diagnostics.
   */
  constructor(baseUrl: string, signer: SigningFunc, logger?: Logger) {
    this._baseUrl = baseUrl;
    this.signer = signer;
    this.logger = logger;
  }

  /**
   * Returns an HTTP Authorization header value.
   * Fetches and caches a short‑lived JWT via NIP‑98 if needed.
   * @param url The URL being requested (scheme+host+path only used for logging/context).
   * @param method HTTP method (for context).
   * @returns Authorization header value in the form `Bearer <token>`.
   */
  async getAuthToken(url: string, method: string) {
    this.logger?.debug(
      `Provider getting token for URL: ${url} - METHOD: ${method}`
    );
    // Pass only required parameters, or none if they are not used
    const token = await this._ensureCachedToken();
    return `Bearer ${token}`;
  }

  /**
   * Produce a NIP‑98 token for challenge/response authentication (e.g., WebSocket).
   * @param url The URL being authenticated.
   * @param method The HTTP verb indicated by the server challenge.
   * @returns Raw NIP‑98 token string.
   */
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
      this.logger
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
