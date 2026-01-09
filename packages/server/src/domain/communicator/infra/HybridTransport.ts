import type { Logger } from "winston";
import type {
  RealTimeTransport,
  TransportEvent,
  WsRequest,
  WebSocketFactory,
  MintAdapter,
  HybridTransportOptions,
} from "./types";
import { WsTransport } from "./WsTransport";
import { PollingTransport } from "./PollingTransport";

const DEFAULT_SLOW_POLLING_MS = 20000;
const DEFAULT_FAST_POLLING_MS = 5000;
const DEFAULT_PERIODIC_RECONNECT_MS = 180000;

export class HybridTransport implements RealTimeTransport {
  private readonly wsTransport: WsTransport;
  private readonly pollingTransport: PollingTransport;
  private readonly logger?: Logger;
  private readonly options: Required<HybridTransportOptions>;

  private readonly wsFailedByMint = new Set<string>();
  private readonly wsConnectedByMint = new Set<string>();
  private readonly hasInternalHandlersByMint = new Set<string>();
  private readonly lastStateByKey = new Map<string, string>();
  private readonly hasEmittedOpenByMint = new Set<string>();

  constructor(
    wsFactory: WebSocketFactory,
    mintAdapter: MintAdapter,
    options?: HybridTransportOptions & { periodicReconnectMs?: number },
    logger?: Logger,
  ) {
    this.logger = logger;
    this.options = {
      slowPollingIntervalMs: options?.slowPollingIntervalMs ?? DEFAULT_SLOW_POLLING_MS,
      fastPollingIntervalMs: options?.fastPollingIntervalMs ?? DEFAULT_FAST_POLLING_MS,
    };

    // Create WsTransport with periodic reconnection enabled
    this.wsTransport = new WsTransport(wsFactory, logger, {
      disableReconnect: false,
      periodicReconnectMs: options?.periodicReconnectMs ?? DEFAULT_PERIODIC_RECONNECT_MS,
    });

    // Create PollingTransport with slow interval initially
    this.pollingTransport = new PollingTransport(
      mintAdapter,
      { intervalMs: this.options.slowPollingIntervalMs },
      logger,
    );
  }

  on(
    mintUrl: string,
    event: TransportEvent,
    handler: (evt: any) => void,
  ): void {
    const wrappedHandler = this.createDedupeHandler(mintUrl, event, handler);

    this.wsTransport.on(mintUrl, event, wrappedHandler);
    this.pollingTransport.on(mintUrl, event, wrappedHandler);

    this.ensureInternalHandlers(mintUrl);
  }

  send(mintUrl: string, req: WsRequest): void {
    this.wsTransport.send(mintUrl, req);
    this.pollingTransport.send(mintUrl, req);
  }

  closeAll(): void {
    this.wsTransport.closeAll();
    this.pollingTransport.closeAll();

    this.wsFailedByMint.clear();
    this.wsConnectedByMint.clear();
    this.hasInternalHandlersByMint.clear();
    this.lastStateByKey.clear();
    this.hasEmittedOpenByMint.clear();
  }

  closeMint(mintUrl: string): void {
    this.wsTransport.closeMint(mintUrl);
    this.pollingTransport.closeMint(mintUrl);

    this.wsFailedByMint.delete(mintUrl);
    this.wsConnectedByMint.delete(mintUrl);
    this.hasInternalHandlersByMint.delete(mintUrl);
    this.hasEmittedOpenByMint.delete(mintUrl);

    for (const key of this.lastStateByKey.keys()) {
      if (key.startsWith(`${mintUrl}::`)) {
        this.lastStateByKey.delete(key);
      }
    }
  }

  private ensureInternalHandlers(mintUrl: string): void {
    if (this.hasInternalHandlersByMint.has(mintUrl)) return;
    this.hasInternalHandlersByMint.add(mintUrl);

    this.wsTransport.on(mintUrl, "open", () => {
      this.wsConnectedByMint.add(mintUrl);
      this.wsFailedByMint.delete(mintUrl);
      // Slow down polling when WS is connected
      this.pollingTransport.setIntervalForMint(
        mintUrl,
        this.options.slowPollingIntervalMs,
      );
      this.logger?.info("[Hybrid] WS connected, slowing polling", {
        transport: "hybrid",
        mintUrl,
        pollingIntervalMs: this.options.slowPollingIntervalMs,
      });
    });

    this.wsTransport.on(mintUrl, "close", () => {
      this.handleWsFailure(mintUrl);
    });

    this.wsTransport.on(mintUrl, "error", () => {
      this.handleWsFailure(mintUrl);
    });
  }

  private handleWsFailure(mintUrl: string): void {
    if (this.wsFailedByMint.has(mintUrl)) return;
    this.wsFailedByMint.add(mintUrl);
    this.wsConnectedByMint.delete(mintUrl);
    this.updatePollingInterval(mintUrl);
    this.logger?.info("[Hybrid] WS failed, speeding up polling", {
      transport: "hybrid",
      mintUrl,
      pollingIntervalMs: this.options.fastPollingIntervalMs,
    });
  }

  private updatePollingInterval(mintUrl: string): void {
    this.pollingTransport.setIntervalForMint(
      mintUrl,
      this.options.fastPollingIntervalMs,
    );
  }

  private createDedupeHandler(
    mintUrl: string,
    event: TransportEvent,
    originalHandler: (evt: any) => void,
  ): (evt: any) => void {
    return (evt: any) => {
      // Dedupe 'open' events - only emit once per mint
      if (event === "open") {
        if (this.hasEmittedOpenByMint.has(mintUrl)) return;
        this.hasEmittedOpenByMint.add(mintUrl);
        originalHandler(evt);
        return;
      }

      // Pass through close/error events without deduplication
      if (event === "close" || event === "error") {
        originalHandler(evt);
        return;
      }

      // For 'message' events, dedupe based on state
      try {
        const data =
          typeof evt.data === "string" ? evt.data : evt.data?.toString?.();
        if (!data) {
          originalHandler(evt);
          return;
        }

        const parsed = JSON.parse(data);

        // Only dedupe subscription notifications (method === 'subscribe')
        if (parsed.method !== "subscribe") {
          originalHandler(evt);
          return;
        }

        const key = this.getStateKey(mintUrl, parsed);
        const stateJson = JSON.stringify(parsed.params?.payload?.state);

        const lastState = this.lastStateByKey.get(key);
        if (lastState === stateJson) {
          // Duplicate state, skip
          this.logger?.debug("[Hybrid] Deduplicating notification (same state)", {
            transport: "hybrid",
            mintUrl,
            key,
            state: stateJson,
          });
          return;
        }

        this.lastStateByKey.set(key, stateJson);
        originalHandler(evt);
      } catch {
        // Parse failed, pass through
        originalHandler(evt);
      }
    };
  }

  private getStateKey(
    mintUrl: string,
    notification: { params?: { subId?: string; payload?: { quote?: string } } },
  ): string {
    const subId = notification.params?.subId ?? "";
    const quote = notification.params?.payload?.quote ?? "";
    return `${mintUrl}::${subId}::${quote}`;
  }
}
