import { describe, expect, test } from "bun:test";
import type {
  RealTimeTransport,
  TransportEvent,
  WebSocketLike,
  WsRequest,
} from "@/domain/communicator/infra/types";
import { WsTransport } from "@/domain/communicator/infra/WsTransport";
import { WebSocketQuoteTransport } from "./WebSocketQuoteTransport";

class FakeTransport implements RealTimeTransport {
  readonly handlers = new Map<string, Map<TransportEvent, (event: any) => void>>();
  readonly sent: Array<{ mintUrl: string; request: WsRequest }> = [];
  readonly closedMints: string[] = [];

  on(
    mintUrl: string,
    event: TransportEvent,
    handler: (event: any) => void,
  ): void {
    let handlers = this.handlers.get(mintUrl);
    if (!handlers) {
      handlers = new Map();
      this.handlers.set(mintUrl, handlers);
    }
    handlers.set(event, handler);
  }

  send(mintUrl: string, request: WsRequest): void {
    this.sent.push({ mintUrl, request });
  }

  closeMint(mintUrl: string): void {
    this.closedMints.push(mintUrl);
  }

  closeAll(): void {}

  emit(mintUrl: string, event: TransportEvent, payload: any = {}): void {
    this.handlers.get(mintUrl)?.get(event)?.(payload);
  }
}

class FakeSocket implements WebSocketLike {
  readyState = 0;
  readonly sent: string[] = [];
  private readonly listeners = new Map<
    "open" | "message" | "error" | "close",
    Set<(event: any) => void>
  >();

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 2;
  }

  addEventListener(
    type: "open" | "message" | "error" | "close",
    listener: (event: any) => void,
  ): void {
    let listeners = this.listeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(type, listeners);
    }
    listeners.add(listener);
  }

  removeEventListener(
    type: "open" | "message" | "error" | "close",
    listener: (event: any) => void,
  ): void {
    this.listeners.get(type)?.delete(listener);
  }

  beginClosing(): void {
    this.readyState = 2;
  }

  emit(type: "open" | "message" | "error" | "close", event: any = {}): void {
    if (type === "open") this.readyState = 1;
    if (type === "close") this.readyState = 3;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

describe("WebSocketQuoteTransport", () => {
  test("re-subscribes each active quote once per real reopen and closes the final quote", () => {
    const transport = new FakeTransport();
    let subNumber = 0;
    const quotes = new WebSocketQuoteTransport({
      transport,
      createSubscriptionId: () => `sub-${++subNumber}`,
    });

    const unsubscribeFirst = quotes.watch(
      "https://mint.example.com",
      "quote-1",
      () => {},
    );
    const unsubscribeSecond = quotes.watch(
      "https://mint.example.com",
      "quote-2",
      () => {},
    );
    expect(transport.sent.map((entry) => entry.request.method)).toEqual([
      "subscribe",
      "subscribe",
    ]);

    transport.emit("https://mint.example.com", "open");
    expect(transport.sent).toHaveLength(2);
    transport.emit("https://mint.example.com", "close");
    const unsubscribeDuringReconnect = quotes.watch(
      "https://mint.example.com",
      "quote-3",
      () => {},
    );
    transport.emit("https://mint.example.com", "open");
    expect(
      transport.sent.filter((entry) => entry.request.method === "subscribe"),
    ).toHaveLength(5);

    unsubscribeFirst();
    expect(transport.closedMints).toEqual([]);
    unsubscribeSecond();
    expect(transport.closedMints).toEqual([]);
    unsubscribeDuringReconnect();
    expect(transport.closedMints).toEqual(["https://mint.example.com"]);
  });

  test("ignores malformed quote notifications", async () => {
    const transport = new FakeTransport();
    const payloads: unknown[] = [];
    const quotes = new WebSocketQuoteTransport({
      transport,
      createSubscriptionId: () => "sub-1",
    });
    quotes.watch("https://mint.example.com", "quote-1", (payload) => {
      payloads.push(payload);
    });

    transport.emit("https://mint.example.com", "message", {
      data: JSON.stringify({
        jsonrpc: "2.0",
        method: "subscribe",
        params: {
          subId: "sub-1",
          payload: { quote: "quote-1", state: "PAID" },
        },
      }),
    });
    await Promise.resolve();

    expect(payloads).toEqual([]);
  });

  test("subscribes a quote added while the old socket is closing exactly once", () => {
    const sockets: FakeSocket[] = [];
    const transport = new WsTransport(
      () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      undefined,
      { disableReconnect: true, periodicReconnectMs: 1_000_000 },
    );
    let subNumber = 0;
    const quotes = new WebSocketQuoteTransport({
      transport,
      createSubscriptionId: () => `sub-${++subNumber}`,
    });

    quotes.watch("https://mint.example.com", "quote-1", () => {});
    sockets[0]!.emit("open");
    sockets[0]!.beginClosing();

    quotes.watch("https://mint.example.com", "quote-2", () => {});
    sockets[0]!.emit("close");
    sockets[1]!.emit("open");

    const replacementSubscriptions = sockets[1]!.sent
      .map((message) => JSON.parse(message) as WsRequest)
      .filter((request) => request.method === "subscribe");
    expect(
      replacementSubscriptions.filter(
        (request) =>
          "filters" in request.params && request.params.filters[0] === "quote-2",
      ),
    ).toHaveLength(1);

    quotes.stop();
  });
});
