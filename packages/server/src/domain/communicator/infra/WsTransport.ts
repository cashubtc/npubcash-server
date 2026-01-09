import type { Logger } from "winston";
import type {
  RealTimeTransport,
  TransportEvent,
  WsRequest,
  WebSocketFactory,
  WsConnectionManagerOptions,
} from "./types";
import { WsConnectionManager } from "./WsConnectionManager";

export class WsTransport implements RealTimeTransport {
  private readonly ws: WsConnectionManager;

  constructor(
    wsFactory: WebSocketFactory,
    logger?: Logger,
    options?: WsConnectionManagerOptions,
  ) {
    this.ws = new WsConnectionManager(wsFactory, logger, options);
  }

  on(
    mintUrl: string,
    event: TransportEvent,
    handler: (evt: any) => void,
  ): void {
    this.ws.on(mintUrl, event, handler);
  }

  send(mintUrl: string, req: WsRequest): void {
    this.ws.send(mintUrl, req);
  }

  closeAll(): void {
    this.ws.closeAll();
  }

  closeMint(mintUrl: string): void {
    this.ws.closeMint(mintUrl);
  }

  isConnected(mintUrl: string): boolean {
    return this.ws.isConnected(mintUrl);
  }
}
