import { describe, expect, test } from "bun:test";
import { MintQuote, type MintQuoteState } from "@/domain/mintQuote/MintQuote";
import type { MintQuotePayload } from "@/domain/mintQuoteMonitor/MintQuoteClient";
import { EventEmitter, type Events } from "@/events";
import type { QuoteObservation } from "./QuoteObservation";
import type { QuoteObservationHandler } from "./QuoteObservationHandler";
import { DefaultQuoteWebSocketService } from "./QuoteWebSocketService";
import type { QuoteWebSocketTransport } from "./QuoteWebSocketTransport";

const now = new Date("2026-08-10T12:00:00.000Z");

function quote(
  id: number,
  state: MintQuoteState = "UNPAID",
  expiresAt = new Date(now.getTime() + 60_000),
): MintQuote {
  return new MintQuote({
    id,
    createdAt: new Date(now.getTime() - 1_000),
    mintUrl: "HTTPS://MINT.EXAMPLE.COM/",
    paymentRequest: "lnbc1",
    unit: "sat",
    quoteId: `quote-${id}`,
    expiresAt,
    amount: 21,
    pubkey: "pubkey",
    state,
    locked: false,
  });
}

function payload(quoteId: string): MintQuotePayload {
  return {
    quote: quoteId,
    request: "lnbc1",
    state: "PAID",
  };
}

class FakeHandler implements QuoteObservationHandler {
  readonly observations: QuoteObservation[] = [];

  async handle(observation: QuoteObservation): Promise<undefined> {
    this.observations.push(observation);
    return undefined;
  }
}

class FakeTransport implements QuoteWebSocketTransport {
  readonly watches: Array<{ mintUrl: string; quoteId: string }> = [];
  readonly callbacks = new Map<
    string,
    (payload: MintQuotePayload) => void | Promise<void>
  >();
  readonly failingQuoteIds = new Set<string>();
  unsubscribeCount = 0;
  stopCount = 0;

  watch(
    mintUrl: string,
    quoteId: string,
    onPayload: (payload: MintQuotePayload) => void | Promise<void>,
  ): () => void {
    if (this.failingQuoteIds.has(quoteId)) {
      throw new Error("setup failed");
    }
    this.watches.push({ mintUrl, quoteId });
    this.callbacks.set(quoteId, onPayload);
    return () => {
      if (this.callbacks.delete(quoteId)) this.unsubscribeCount += 1;
    };
  }

  stop(): void {
    this.stopCount += 1;
    this.callbacks.clear();
  }

  async emit(quoteId: string, value: MintQuotePayload): Promise<void> {
    await this.callbacks.get(quoteId)?.(value);
  }
}

function createService(input: {
  activeQuotes?: MintQuote[];
  events?: EventEmitter<Events>;
  handler?: FakeHandler;
  transport?: FakeTransport;
}) {
  const events = input.events ?? new EventEmitter<Events>();
  const handler = input.handler ?? new FakeHandler();
  const transport = input.transport ?? new FakeTransport();
  const requestedAt: Date[] = [];
  const service = new DefaultQuoteWebSocketService({
    store: {
      getActiveUnpaidQuotes: async (at) => {
        requestedAt.push(at);
        return input.activeQuotes ?? [];
      },
    },
    handler,
    transport,
    events,
    now: () => now,
  });
  return { service, events, handler, transport, requestedAt };
}

describe("QuoteWebSocketService", () => {
  test("restores active unpaid quotes on startup", async () => {
    const active = quote(1);
    const { service, transport, requestedAt } = createService({
      activeQuotes: [active],
    });

    await service.start();

    expect(requestedAt).toEqual([now]);
    expect(transport.watches).toEqual([
      { mintUrl: "https://mint.example.com", quoteId: active.quoteId },
    ]);
  });

  test("subscribes newly created unexpired quotes", async () => {
    const { service, events, transport } = createService({});
    await service.start();

    events.emit("mintQuote.created", quote(1, "UNPAID", now));
    events.emit("mintQuote.created", quote(2, "PAID"));
    events.emit("mintQuote.created", quote(3));

    expect(transport.watches.map(({ quoteId }) => quoteId)).toEqual([
      "quote-3",
    ]);
  });

  test("forwards payloads with the internal quote ID", async () => {
    const active = quote(21);
    const { service, transport, handler } = createService({
      activeQuotes: [active],
    });
    await service.start();

    const notification = payload(active.quoteId);
    await transport.emit(active.quoteId, notification);

    expect(handler.observations).toEqual([
      {
        source: "websocket",
        mintQuoteId: active.id,
        payload: notification,
      },
    ]);
  });

  test("unsubscribes terminal state changes", async () => {
    const active = quote(1);
    const { service, events, transport } = createService({
      activeQuotes: [active],
    });
    await service.start();

    events.emit("mintQuote.stateChanged", {
      quote: quote(active.id, "PAID"),
      source: "polling",
    });

    expect(transport.unsubscribeCount).toBe(1);
    expect(transport.callbacks.size).toBe(0);
  });

  test("isolates one WebSocket setup failure", async () => {
    const transport = new FakeTransport();
    transport.failingQuoteIds.add("quote-1");
    const { service } = createService({
      activeQuotes: [quote(1), quote(2)],
      transport,
    });

    await expect(service.start()).resolves.toBeUndefined();
    expect(transport.watches.map(({ quoteId }) => quoteId)).toEqual([
      "quote-2",
    ]);
  });

  test("removes listeners and subscriptions on shutdown", async () => {
    const active = quote(1);
    const { service, events, transport } = createService({
      activeQuotes: [active],
    });
    await service.start();

    await service.stop();
    events.emit("mintQuote.created", quote(2));

    expect(transport.unsubscribeCount).toBe(1);
    expect(transport.stopCount).toBe(1);
    expect(transport.watches.map(({ quoteId }) => quoteId)).toEqual([
      active.quoteId,
    ]);
  });
});
