import type { QuotesResponse, UserResponse } from "npubcash-types";

type ApiResponse = QuotesResponse | UserResponse;

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

interface AuthenticatedRequest {
  <T extends ApiResponse>(path: string, options?: RequestOptions): Promise<T>;
}

/**
 * Settings API used via {@link NPCClient.settings}.
 *
 * Not exported directly; consumers use the instance available on the client.
 */
export class SettingsManager {
  private readonly _authenticatedRequest: AuthenticatedRequest;

  constructor(authenticatedRequest: AuthenticatedRequest) {
    this._authenticatedRequest = authenticatedRequest;
  }

  /**
   * Update the user's preferred mint URL.
   * @param mintUrl Fully‑qualified Cashu mint URL.
   * @returns Updated user settings resource.
   */
  async setMintUrl(mintUrl: string) {
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
      console.log("Mint URL updated successfully:", response);
      return response;
    } catch (error) {
      console.error("Error updating mint URL:", error);
      throw error;
    }
  }

  /**
   * Enable or disable quote locking for the user.
   * @param lockQuotes When true, new quotes are locked by default.
   * @returns Updated user settings resource.
   */
  async setLock(lockQuotes: boolean) {
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
      console.log("Locking updated successfully:", response);
      return response;
    } catch (error) {
      console.error("Error updating lock setting:", error);
      throw error;
    }
  }
}
