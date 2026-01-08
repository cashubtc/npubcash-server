import type { EventTemplate, SignedEvent } from "./types";

declare global {
  interface Window {
    nostr?: {
      signEvent(event: EventTemplate): Promise<SignedEvent>;
    };
  }
}
