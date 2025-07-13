import { type ErrorResponse } from "./common";

/**
 * Represents a user in the system.
 */
export type User = {
  pubkey: string;
  name?: string;
  mintUrl: string;
  lockQuote: boolean;
};

/**
 * Payload for setting the user's mint URL.
 */
export type SetMintPayload = {
  mint_url: string;
};

/**
 * Payload for setting the user's lock quotes status.
 */
export type SetLockQuotesPayload = {
  lockQuotes: boolean;
};

/**
 * Payload for setting the user's username.
 */
export type SetUsernamePayload = {
  username: string;
};

/**
 * Represents a successful user response.
 */
export type UserResponse = {
  error: false;
  data: {
    user: User;
  };
};

/**
 * Represents the possible response types for user-related operations,
 * either a successful UserResponse or an ErrorResponse.
 */
export type UserResponseType = UserResponse | ErrorResponse;
