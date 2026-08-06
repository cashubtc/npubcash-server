import { IncomingMessage } from "http";
import wss from "./server";
import Stream from "stream";
import { WebSocketConnection } from "./connection";
import { config } from "@/config/index";
import { getPublicWebSocketUrl } from "@/utils/publicRequest";

export function websocketUpgradeController(
  req: IncomingMessage,
  socket: Stream.Duplex,
  head: Buffer,
) {
  const websocketPath = "/api/v2/ws/quote";
  if (req.url === websocketPath) {
    let url: string;
    try {
      url = getPublicWebSocketUrl(req, config.allowedHostnames).toString();
    } catch {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const conn = new WebSocketConnection(ws, url);
      wss.emit("connection", ws, req, conn);
    });
  } else {
    socket.destroy();
  }
}
