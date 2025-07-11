import { type ErrorResponse } from "./common";

export interface Nip98Response {
  error: false;
  data: {
    token: string;
  };
}

export type Nip98ResponseType = Nip98Response | ErrorResponse;
