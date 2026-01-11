import { MintQuote } from "./domain/mintQuote/MintQuote";
import { logger } from "./utils/logger";

type Events = {
  quotePaid: MintQuote;
};

type EventHandler<T> = (payload: T) => void;

export class EventEmitter<T extends Record<string, any>> {
  private listeners: { [K in keyof T]?: EventHandler<T[K]>[] } = {};

  on<K extends keyof T>(event: K, handler: EventHandler<T[K]>) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(handler);
  }

  emit<K extends keyof T>(event: K, payload: T[K]) {
    logger.debug(`Emitting event - type: ${String(event)}`);
    this.listeners[event]?.forEach((cb) => cb(payload));
  }
}

export const eventBus = new EventEmitter<Events>();
