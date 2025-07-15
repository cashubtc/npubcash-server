import type {
  Nip98Response,
  QuotesResponse,
  UserResponse,
} from "npubcash-types";

declare global {
  interface Window {
    nostr?: {
      signEvent(event: EventTemplate): Promise<SignedEvent>;
    };
  }
}

export type EventTemplate = Omit<SignedEvent, "id" | "sig" | "pubkey">;

export type SignedEvent = {
  kind: number;
  tags: string[][];
  content: string;
  created_at: number;
  pubkey: string;
  id: string;
  sig: string;
};

export type SigningFunc = (t: EventTemplate) => Promise<SignedEvent>;

export type ApiResponse = QuotesResponse | UserResponse | Nip98Response;

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = status || 500;
  }
}
