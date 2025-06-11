import { IncomingMessage } from "http";
import wss from "./server";
import Stream from "stream";
import { WebSocketConnection } from "./connection";

export function websocketUpgradeController(
  req: IncomingMessage,
  socket: Stream.Duplex,
  head: Buffer,
) {
  const websocketPath = "/api/v2/ws/quote";
  if (req.url === websocketPath) {
    const host = req.headers.host;
    const protocol = process.env.NODE_ENV === "production" ? "wss" : "ws";
    const url = `${protocol}://${host}${websocketPath}`;
    wss.handleUpgrade(req, socket, head, (ws) => {
      const conn = new WebSocketConnection(ws, url);
      wss.emit("connection", ws, req, conn);
    });
  } else {
    socket.destroy();
  }
}
