import type { Event } from "nostr-tools";

export function decodeZapRequestParameter(value: string): Event {
  try {
    return JSON.parse(value) as Event;
  } catch {
    // Query parsers already decode standards-compliant parameter values. Some
    // clients, including Primal, encode the JSON before passing it to
    // URLSearchParams and therefore leave one extra encoding layer behind.
    return JSON.parse(decodeURIComponent(value)) as Event;
  }
}
