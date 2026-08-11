import { BadRequestError } from "@/errors";
import { IncomingMessage } from "http";

type PublicRequest = IncomingMessage & { originalUrl?: string };

function getFirstHeader(req: IncomingMessage, name: string) {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function getPublicProtocol(req: IncomingMessage): "http" | "https" {
  const forwardedProtocol = getFirstHeader(req, "x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();

  if (forwardedProtocol) {
    if (forwardedProtocol !== "http" && forwardedProtocol !== "https") {
      throw new BadRequestError("Invalid forwarded protocol");
    }
    return forwardedProtocol;
  }

  if ("encrypted" in req.socket && req.socket.encrypted === true) {
    return "https";
  }
  return "http";
}

export function getPublicRequestUrl(
  req: PublicRequest,
  allowedHostnames: readonly string[] = [],
): URL {
  const host = req.headers.host?.trim();
  if (!host) {
    throw new BadRequestError("Missing Host header");
  }

  const protocol = getPublicProtocol(req);
  let origin: URL;
  try {
    origin = new URL(`${protocol}://${host}`);
  } catch {
    throw new BadRequestError("Invalid Host header");
  }

  if (
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new BadRequestError("Invalid Host header");
  }

  const hostname = origin.hostname.toLowerCase();
  if (allowedHostnames.length > 0 && !allowedHostnames.includes(hostname)) {
    throw new BadRequestError("Host is not allowed");
  }

  const requestTarget = req.originalUrl ?? req.url;
  if (!requestTarget?.startsWith("/")) {
    throw new BadRequestError("Invalid request target");
  }

  return new URL(`${origin.origin}${requestTarget}`);
}

export function getPublicWebSocketUrl(
  req: PublicRequest,
  allowedHostnames: readonly string[] = [],
): URL {
  const url = getPublicRequestUrl(req, allowedHostnames);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url;
}
