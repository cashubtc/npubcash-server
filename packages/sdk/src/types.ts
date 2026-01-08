import type { PaymentRequest } from "@cashu/cashu-ts";
import type {
  Nip98Response,
  QuotesResponse,
  UserResponse,
} from "npubcash-types";

// ─────────────────────────────────────────────────────────────────────────────
// Nostr Event Types
// ─────────────────────────────────────────────────────────────────────────────

export type SignedEvent = {
  kind: number;
  tags: string[][];
  content: string;
  created_at: number;
  pubkey: string;
  id: string;
  sig: string;
};

export type EventTemplate = Omit<SignedEvent, "id" | "sig" | "pubkey">;

export type SigningFunc = (t: EventTemplate) => Promise<SignedEvent>;

// ─────────────────────────────────────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Abstraction for authentication used by {@link NPCClient}.
 *
 * Implementations should provide:
 * - an HTTP auth token (e.g., a short-lived JWT in `Bearer <token>` or Nostr token form)
 * - a NIP-98 token for WebSocket challenge/response
 */
export interface AuthProvider {
  getAuthToken(url: string, method: string): Promise<string>;
  getNostrToken(url: string, method: string): Promise<string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Types
// ─────────────────────────────────────────────────────────────────────────────

export type ApiResponse = QuotesResponse | UserResponse | Nip98Response;

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = status || 500;
  }
}

export class PaymentRequiredError extends ApiError {
  paymentRequest: PaymentRequest;
  constructor(message: string, paymentRequest: PaymentRequest) {
    super(message, 402);
    this.paymentRequest = paymentRequest;
  }
}
