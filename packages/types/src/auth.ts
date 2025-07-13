import { type ErrorResponse } from "./common";

export type Nip98Response = {
  error: false;
  data: {
    token: string;
  };
};

export type Nip98ResponseType = Nip98Response | ErrorResponse;
