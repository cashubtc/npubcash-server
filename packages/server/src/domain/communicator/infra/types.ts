import type { Logger } from "winston";

export type JsonRpcId = number;

export type WsRequestMethod = "subscribe" | "unsubscribe";

export type SubscriptionKind = "bolt11_mint_quote";

export type UnsubscribeHandler = () => void;

export interface SubscribeParams {
  kind: SubscriptionKind;
  subId: string;
  filters: string[];
}

export interface UnsubscribeParams {
  subId: string;
}

export type WsRequest = {
  jsonrpc: "2.0";
  method: WsRequestMethod;
  params: SubscribeParams | UnsubscribeParams;
  id: JsonRpcId;
};

export type WsResponse = {
  jsonrpc: "2.0";
  result?: { status: "OK"; subId: string };
  error?: { code: number; message: string };
  id: JsonRpcId;
};

export type WsNotification<TPayload> = {
  jsonrpc: "2.0";
  method: "subscribe";
  params: { subId: string; payload: TPayload };
};

export type MintQuoteState = "UNPAID" | "PAID" | "ISSUED" | "PENDING";

export interface MintQuotePayload {
  quote: string;
  request: string;
  state: MintQuoteState;
  expiry: number;
}

export type TransportEvent = "open" | "message" | "error" | "close";

export interface RealTimeTransport {
  on(mintUrl: string, event: TransportEvent, handler: (evt: any) => void): void;
  send(mintUrl: string, req: WsRequest): void;
  closeAll(): void;
  closeMint(mintUrl: string): void;
}

export interface MintAdapter {
  checkMintQuoteState(
    mintUrl: string,
    quoteId: string,
  ): Promise<MintQuotePayload>;
}

export interface HybridTransportOptions {
  slowPollingIntervalMs?: number;
  fastPollingIntervalMs?: number;
}

export interface PollingOptions {
  intervalMs?: number;
}

export interface WsConnectionManagerOptions {
  disableReconnect?: boolean;
  periodicReconnectMs?: number;
}

export interface WebSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(
    type: "open" | "message" | "error" | "close",
    listener: (event: any) => void,
  ): void;
  removeEventListener(
    type: "open" | "message" | "error" | "close",
    listener: (event: any) => void,
  ): void;
  readyState: number;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

export type SubscriptionCallback<TPayload = unknown> = (
  payload: TPayload,
) => void | Promise<void>;

export interface HybridSubscriptionManagerOptions {
  slowPollingIntervalMs?: number;
  fastPollingIntervalMs?: number;
  periodicReconnectMs?: number;
  logger?: Logger;
}
