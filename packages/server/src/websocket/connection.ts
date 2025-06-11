import { verifyAuth } from "@/utils/auth";
import { RawData, WebSocket } from "ws";
import { subManager } from "./subs";

type ParsedWebSocketMessage = {
  type: "challenge-response";
  payload: string;
};

export class WebSocketConnection {
  url: string;
  timer: NodeJS.Timeout;
  socket: WebSocket;
  pubkey?: string;

  constructor(ws: WebSocket, url: string) {
    this.socket = ws;
    this.url = url;
    this.timer = setTimeout(() => {
      this.send("error", "Unauthorized");
      this.close();
    }, 15000);
    this.send("challenge", { url, method: "GET" });
    ws.on("close", () => {
      this.close();
    });
  }

  authorise(pubkey: string) {
    this.pubkey = pubkey;
    clearTimeout(this.timer);
    this.socket.send(JSON.stringify({ type: "challenge-success" }));
    subManager.addListener(pubkey, (quote) => {
      this.send("update", { quoteId: quote.quoteId });
      this.socket.send(
        JSON.stringify({
          type: "update",
          payload: { quoteId: quote.quoteId },
        }),
      );
    });
  }

  close() {
    clearTimeout(this.timer);
    if (this.pubkey) {
      subManager.removeListener(this.pubkey);
    }
    this.socket.removeAllListeners("message");
    this.socket.removeAllListeners("close");
    this.socket.close();
  }

  async handleMessage(m: RawData) {
    try {
      const parsed = JSON.parse(m.toString("utf8")) as ParsedWebSocketMessage;
      if (parsed.type === "challenge-response") {
        const isAuth = await verifyAuth(parsed.payload, this.url, "GET", "");
        if (!isAuth.authorized) {
          this.send("error", "Unauthtorized");
          return;
        }
        this.authorise(isAuth.data.pubkey);
      }
    } catch {}
  }
  private send(type: string, payload: any) {
    if (this.socket.readyState === 1) {
      this.socket.send(JSON.stringify({ type, payload }));
    }
  }
}
