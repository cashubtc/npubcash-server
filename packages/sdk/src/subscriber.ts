import type { AuthProvider } from "./client";
import type { Logger } from "./logger";

type ServerMessage =
  | { type: "challenge"; payload: { url: string; method: string } }
  | { type: "challenge-success" }
  | { type: "update"; payload: { quoteId: string } }
  | { type: "error"; payload?: string };

export class SubscriptionManager {
  private socket: WebSocket | null;
  private provider: AuthProvider;
  private onUpdate: (quoteId: string) => void;
  private onError?: (message: string) => void;
  private logger?: Logger;

  private boundOnOpen: () => void;
  private boundOnMessage: (ev: MessageEvent) => void;
  private boundOnError: (ev: Event) => void;
  private boundOnClose: () => void;

  constructor(
    url: string,
    provider: AuthProvider,
    onUpdate: (quoteId: string) => void,
    logger?: Logger,
    onError?: (message: string) => void
  ) {
    this.provider = provider;
    this.onUpdate = onUpdate;
    this.onError = onError;
    this.logger = logger;

    this.socket = new WebSocket(url);

    this.boundOnOpen = this.onOpen.bind(this);
    this.boundOnMessage = this.onMessage.bind(this);
    this.boundOnError = this.onSocketError.bind(this);
    this.boundOnClose = this.onClose.bind(this);

    this.socket.addEventListener("open", this.boundOnOpen);
    this.socket.addEventListener("message", this.boundOnMessage);
    this.socket.addEventListener("error", this.boundOnError);
    this.socket.addEventListener("close", this.boundOnClose);
  }

  dispose() {
    if (!this.socket) return;
    this.socket.removeEventListener("open", this.boundOnOpen);
    this.socket.removeEventListener("message", this.boundOnMessage);
    this.socket.removeEventListener("error", this.boundOnError);
    this.socket.removeEventListener("close", this.boundOnClose);
    try {
      this.socket.close(1000);
    } catch {}
    this.socket = null;
  }

  private onOpen() {
    this.logger?.debug("WebSocket connection opened");
  }

  private onClose() {
    this.logger?.debug("WebSocket connection closed");
  }

  private onSocketError(_: Event) {
    this.logger?.error("WebSocket error");
  }

  private onMessage(ev: MessageEvent) {
    if (typeof ev.data !== "string") return;
    try {
      const parsed = JSON.parse(ev.data) as ServerMessage;
      switch (parsed.type) {
        case "challenge":
          void this.handleChallenge(parsed.payload);
          break;
        case "challenge-success":
          this.logger?.debug("WebSocket challenge success");
          break;
        case "update":
          this.onUpdate(parsed.payload.quoteId);
          break;
        case "error":
          this.logger?.error(
            `WebSocket server error${
              parsed.payload ? ": " + parsed.payload : ""
            }`
          );
          this.onError?.(parsed.payload || "Unknown WebSocket error");
          break;
        default:
          this.logger?.debug("Received unknown WebSocket message type");
      }
    } catch (e) {
      this.logger?.error("Failed to parse WebSocket message", e as any);
    }
  }

  private async handleChallenge(payload: { url: string; method: string }) {
    try {
      const token = await this.provider.getNostrToken(
        payload.url,
        payload.method
      );
      this.socket?.send(
        JSON.stringify({
          type: "challenge-response",
          payload: "Nostr " + token,
        })
      );
    } catch (e) {
      this.logger?.error("Failed to handle WebSocket challenge", e as any);
      this.onError?.("Authentication failed");
      this.dispose();
    }
  }
}
