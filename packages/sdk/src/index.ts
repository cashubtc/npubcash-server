/**
 * NpubCash SDK public entrypoint.
 *
 * Exposes the main client, authentication provider, and logging utilities.
 *
 * - Use `NPCClient` to interact with the NpubCash HTTP and WebSocket APIs
 * - Use `JWTAuthProvider` to obtain and cache short‑lived JWTs via NIP‑98
 * - Use `ConsoleLogger` or provide your own `Logger` implementation for observability
 */
export { JWTAuthProvider } from "./provider.ts";
export { NPCClient } from "./client.ts";
export { type Logger, ConsoleLogger } from "./logger.ts";
