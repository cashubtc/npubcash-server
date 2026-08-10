import type { QuoteStateChange } from "./domain/mintQuoteMonitoring/QuoteObservation";
import { logger } from "./utils/logger";

export type Events = {
  "mintQuote.stateChanged": QuoteStateChange;
};

type EventHandler<T> = (payload: T) => void | Promise<void>;

export class EventEmitter<T extends object> {
  private listeners: { [K in keyof T]?: EventHandler<T[K]>[] } = {};

  on<K extends keyof T>(event: K, handler: EventHandler<T[K]>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(handler);
    return () => {
      const listeners = this.listeners[event];
      if (!listeners) return;
      this.listeners[event] = listeners.filter((entry) => entry !== handler);
    };
  }

  emit<K extends keyof T>(event: K, payload: T[K]): void {
    logger.debug(`Emitting event - type: ${String(event)}`);
    for (const listener of [...(this.listeners[event] ?? [])]) {
      try {
        void Promise.resolve(listener(payload)).catch((cause) => {
          logger.error("Event listener rejected", {
            event: String(event),
            cause,
          });
        });
      } catch (cause) {
        logger.error("Event listener threw", {
          event: String(event),
          cause,
        });
      }
    }
  }
}

export const eventBus = new EventEmitter<Events>();
