import { describe, expect, test } from "bun:test";
import type {
  RealTimeTransport,
  TransportEvent,
  WebSocketLike,
  WsRequest,
} from "@/domain/communicator/infra/types";
import { WsTransport } from "@/domain/communicator/infra/WsTransport";
import { PerMintRequestBudget } from "@/infrastructure/MintRequestBudget";
import { FetchMintQuoteClient } from "./MintQuoteClient";
import { WebSocketQuoteTransport } from "./WebSocketQuoteTransport";

class FakeTransport implements RealTimeTransport {
  readonly handlers = new Map<string, Map<TransportEvent, (event: any) => void>>();
  readonly sent: Array<{ mintUrl: string; request: WsRequest }> = [];
  readonly closedMints: string[] = [];
  readonly openMints = new Set<string>();

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
    this.openMints.delete(mintUrl);
  }

  closeAll(): void {
    this.openMints.clear();
  }

  isConnected(mintUrl: string): boolean {
    return this.openMints.has(mintUrl);
  }

  emit(mintUrl: string, event: TransportEvent, payload: any = {}): void {
    if (event === "open") this.openMints.add(mintUrl);
    if (event === "close") this.openMints.delete(mintUrl);
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

function emitQuoteNotification(
  transport: FakeTransport,
  subId: string,
  quoteId: string,
): void {
  transport.emit("https://mint.example.com", "message", {
    data: JSON.stringify({
      jsonrpc: "2.0",
      method: "subscribe",
      params: {
        subId,
        payload: {
          quote: quoteId,
          request: `lnbc-${quoteId}`,
          state: "PAID",
          expiry: 1_786_000_000,
        },
      },
    }),
  });
}

describe("WebSocketQuoteTransport", () => {
  test("batches startup quotes and re-subscribes active quotes in one request", () => {
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
    expect(transport.sent).toEqual([]);

    transport.emit("https://mint.example.com", "open");
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]?.request).toMatchObject({
      method: "subscribe",
      params: {
        kind: "bolt11_mint_quote",
        filters: ["quote-1", "quote-2"],
      },
    });
    transport.emit("https://mint.example.com", "close");
    const unsubscribeDuringReconnect = quotes.watch(
      "https://mint.example.com",
      "quote-3",
      () => {},
    );
    expect(transport.sent).toHaveLength(1);
    transport.emit("https://mint.example.com", "open");
    expect(transport.sent).toHaveLength(2);
    expect(transport.sent[1]?.request).toMatchObject({
      method: "subscribe",
      params: {
        kind: "bolt11_mint_quote",
        filters: ["quote-1", "quote-2", "quote-3"],
      },
    });

    unsubscribeFirst();
    expect(transport.closedMints).toEqual([]);
    unsubscribeSecond();
    expect(transport.closedMints).toEqual([]);
    unsubscribeDuringReconnect();
    expect(transport.closedMints).toEqual(["https://mint.example.com"]);
  });

  test("routes a batched subscription by quote and keeps live additions individual", async () => {
    const transport = new FakeTransport();
    const received: string[] = [];
    let subNumber = 0;
    const quotes = new WebSocketQuoteTransport({
      transport,
      createSubscriptionId: () => `sub-${++subNumber}`,
    });

    const unsubscribeFirst = quotes.watch(
      "https://mint.example.com",
      "quote-1",
      () => {
        received.push("quote-1");
      },
    );
    quotes.watch("https://mint.example.com", "quote-2", () => {
      received.push("quote-2");
    });
    transport.emit("https://mint.example.com", "open");

    const unsubscribeThird = quotes.watch(
      "https://mint.example.com",
      "quote-3",
      () => {
        received.push("quote-3");
      },
    );
    expect(
      transport.sent.map((entry) =>
        "filters" in entry.request.params
          ? entry.request.params.filters
          : [],
      ),
    ).toEqual([["quote-1", "quote-2"], ["quote-3"]]);

    unsubscribeFirst();
    emitQuoteNotification(transport, "sub-1", "quote-1");
    emitQuoteNotification(transport, "sub-1", "quote-2");
    emitQuoteNotification(transport, "sub-2", "quote-3");
    await Promise.resolve();

    expect(received).toEqual(["quote-2", "quote-3"]);
    unsubscribeThird();
    expect(transport.sent[2]?.request).toMatchObject({
      method: "unsubscribe",
      params: { subId: "sub-2" },
    });
  });

  test("keeps a batch alive until its final quote is removed", () => {
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
    transport.emit("https://mint.example.com", "open");

    unsubscribeFirst();
    expect(transport.sent).toHaveLength(1);
    expect(transport.closedMints).toEqual([]);

    unsubscribeSecond();
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
    transport.emit("https://mint.example.com", "open");

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

  test("shares one mint request budget between HTTP and WebSocket opens", async () => {
    let now = 0;
    const socketStarts: number[] = [];
    const requestBudget = new PerMintRequestBudget({
      capacity: 1,
      refillPerMinute: 60,
      now: () => now,
      wait: async (delayMs) => {
        now += delayMs;
      },
    });
    const client = new FetchMintQuoteClient({
      fetch: async () =>
        new Response(
          JSON.stringify({
            quote: "quote-1",
            request: "lnbc-quote-1",
            state: "UNPAID",
            expiry: 1_786_000_000,
          }),
        ),
      requestBudget,
    });
    await client.checkQuote("https://mint.example.com", "quote-1");

    const sockets: FakeSocket[] = [];
    const transport = new WsTransport(
      () => {
        socketStarts.push(now);
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      undefined,
      {
        disableReconnect: true,
        periodicReconnectMs: 1_000_000,
        requestBudget,
      },
    );
    transport.on("https://mint.example.com/", "open", () => {});
    for (let turn = 0; turn < 10 && sockets.length < 1; turn += 1) {
      await Promise.resolve();
    }

    sockets[0]!.beginClosing();
    transport.send("https://mint.example.com/", {
      jsonrpc: "2.0",
      method: "subscribe",
      params: {
        kind: "bolt11_mint_quote",
        subId: "sub-1",
        filters: ["quote-1"],
      },
      id: 1,
    });
    for (let turn = 0; turn < 10 && sockets.length < 2; turn += 1) {
      await Promise.resolve();
    }

    expect(socketStarts).toEqual([1_000, 2_000]);
    transport.closeAll();
  });

  test("cancels a WebSocket open waiting for a token when the mint closes", async () => {
    let now = 0;
    let releaseWait!: () => void;
    const waiting = new Promise<void>((resolve) => {
      releaseWait = resolve;
    });
    const requestBudget = new PerMintRequestBudget({
      capacity: 1,
      refillPerMinute: 60,
      now: () => now,
      wait: async (delayMs) => {
        await waiting;
        now += delayMs;
      },
    });
    await requestBudget.schedule("https://mint.example.com", () => undefined);

    const sockets: FakeSocket[] = [];
    const transport = new WsTransport(
      () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      undefined,
      {
        disableReconnect: true,
        periodicReconnectMs: 1_000_000,
        requestBudget,
      },
    );
    transport.on("https://mint.example.com", "open", () => {});
    transport.closeMint("https://mint.example.com");
    releaseWait();
    for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();

    expect(sockets).toEqual([]);
    transport.closeAll();
  });

  test("re-subscribes existing quotes when adding one replaces a closing socket", () => {
    const sockets: FakeSocket[] = [];
    const transport = new WsTransport(
      () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      undefined,
      {
        disableReconnect: true,
        periodicReconnectMs: 1_000_000,
        requestBudget: new PerMintRequestBudget({ capacity: 100 }),
      },
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
    quotes.watch("https://mint.example.com", "quote-3", () => {});
    sockets[0]!.emit("close");
    sockets[1]!.emit("open");

    const replacementSubscriptions = sockets[1]!.sent
      .map((message) => JSON.parse(message) as WsRequest)
      .filter((request) => request.method === "subscribe");
    expect(
      replacementSubscriptions.filter(
        (request) =>
          "filters" in request.params && request.params.filters[0] === "quote-1",
      ),
    ).toHaveLength(1);
    expect(
      replacementSubscriptions.filter(
        (request) =>
          "filters" in request.params && request.params.filters[0] === "quote-2",
      ),
    ).toHaveLength(1);
    expect(
      replacementSubscriptions.filter(
        (request) =>
          "filters" in request.params &&
          request.params.filters.includes("quote-3"),
      ),
    ).toHaveLength(1);

    quotes.stop();
  });

  test("unsubscribes a queued live addition removed before replacement open", () => {
    const sockets: FakeSocket[] = [];
    const transport = new WsTransport(
      () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      undefined,
      {
        disableReconnect: true,
        periodicReconnectMs: 1_000_000,
        requestBudget: new PerMintRequestBudget({ capacity: 100 }),
      },
    );
    let subNumber = 0;
    const quotes = new WebSocketQuoteTransport({
      transport,
      createSubscriptionId: () => `sub-${++subNumber}`,
    });

    quotes.watch("https://mint.example.com", "quote-1", () => {});
    sockets[0]!.emit("open");
    sockets[0]!.beginClosing();

    const unsubscribeSecond = quotes.watch(
      "https://mint.example.com",
      "quote-2",
      () => {},
    );
    unsubscribeSecond();
    sockets[0]!.emit("close");
    sockets[1]!.emit("open");

    const replacementRequests = sockets[1]!.sent.map(
      (message) => JSON.parse(message) as WsRequest,
    );
    expect(replacementRequests.map((request) => request.method)).toEqual([
      "subscribe",
      "unsubscribe",
      "subscribe",
    ]);
    expect(
      replacementRequests.filter(
        (request) =>
          request.method === "subscribe" &&
          "filters" in request.params &&
          request.params.filters.includes("quote-1"),
      ),
    ).toHaveLength(1);

    quotes.stop();
  });
});
