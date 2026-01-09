/**
 * NpubCash SDK public entrypoint.
 *
 * Exposes the main client, authentication provider, and logging utilities.
 *
 * - Use `NPCClient` to interact with the NpubCash HTTP and WebSocket APIs
 * - Use `JWTAuthProvider` to obtain and cache short-lived JWTs via NIP-98
 * - Use `ConsoleLogger` or provide your own `Logger` implementation for observability
 * - Implement `AuthProvider` for custom authentication strategies
 */

// Classes
export { JWTAuthProvider } from "./provider";
export { NPCClient } from "./client";
export { type Logger, ConsoleLogger } from "./logger";

// Types for consumers
export type {
  AuthProvider,
  SigningFunc,
  EventTemplate,
  SignedEvent,
} from "./types";

// Errors
export { ApiError, PaymentRequiredError } from "./types";
