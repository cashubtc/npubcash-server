import WebSocket, { WebSocketServer } from "ws";
import { WebSocketConnection } from "./connection";
import { IncomingMessage } from "http";

const wss = new WebSocketServer({ noServer: true });

wss.on(
  "connection",
  (ws: WebSocket, _: IncomingMessage, conn: WebSocketConnection) => {
    ws.on("message", async (m) => {
      conn.handleMessage(m);
    });
    ws.on("close", () => {
      conn.close();
    });
  },
);

export default wss;
