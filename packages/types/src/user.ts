import { type ErrorResponse } from "./common";

export interface User {
  pubkey: string;
  name?: string;
  mintUrl: string;
  lockQuote: boolean;
}

export interface UserResponse {
  error: false;
  data: {
    user: User;
  };
}

export type UserResponseType = UserResponse | ErrorResponse;
