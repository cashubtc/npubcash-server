import type { UserResponse } from "npubcash-types";

import type { Logger } from "./logger";
import type { ApiResponse, RequestOptions } from "./types";

interface AuthenticatedRequest {
  <T extends ApiResponse>(path: string, options?: RequestOptions): Promise<T>;
}

/**
 * Settings API
 *
 * Not exported directly; consumers use the instance available on the client.
 */
export class SettingsManager {
  private readonly _authenticatedRequest: AuthenticatedRequest;
  private logger?: Logger;

  constructor(authenticatedRequest: AuthenticatedRequest, logger?: Logger) {
    this._authenticatedRequest = authenticatedRequest;
    this.logger = logger;
  }

  /**
   * Set a logger implementation for diagnostics.
   * @internal Called by NPCClient when its logger is updated.
   */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Update the user's preferred mint URL.
   * @param mintUrl Fully-qualified Cashu mint URL.
   * @returns Updated user settings resource.
   */
  async setMintUrl(mintUrl: string): Promise<UserResponse> {
    try {
      const response = await this._authenticatedRequest<UserResponse>(
        "/api/v2/user/mint",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mint_url: mintUrl }),
        }
      );
      this.logger?.info("Mint URL updated successfully");
      return response;
    } catch (error) {
      this.logger?.error("Error updating mint URL:", error);
      throw error;
    }
  }

  /**
   * Enable or disable quote locking for the user.
   * @param lockQuotes When true, new quotes are locked by default.
   * @returns Updated user settings resource.
   */
  async setLock(lockQuotes: boolean): Promise<UserResponse> {
    try {
      const response = await this._authenticatedRequest<UserResponse>(
        "/api/v2/user/lock",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ lockQuotes }),
        }
      );
      this.logger?.info("Lock setting updated successfully");
      return response;
    } catch (error) {
      this.logger?.error("Error updating lock setting:", error);
      throw error;
    }
  }
}
