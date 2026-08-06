import { describe, expect, test } from "bun:test";
import { IncomingMessage } from "http";
import { getPublicRequestUrl, getPublicWebSocketUrl } from "./publicRequest";

function createRequest({
  host = "npub.cash",
  url = "/api/v2/auth/nip98",
  forwardedProtocol,
  encrypted = false,
}: {
  host?: string;
  url?: string;
  forwardedProtocol?: string;
  encrypted?: boolean;
} = {}) {
  return {
    headers: {
      host,
      ...(forwardedProtocol && { "x-forwarded-proto": forwardedProtocol }),
    },
    originalUrl: url,
    url,
    socket: { encrypted },
  } as unknown as IncomingMessage & { originalUrl: string };
}

describe("public request URLs", () => {
  test("derives the complete public URL from the request", () => {
    const req = createRequest({
      host: "NPUB.CASH",
      url: "/api/v2/auth/nip98?canWithdraw=true",
      forwardedProtocol: "https",
    });

    expect(getPublicRequestUrl(req).toString()).toBe(
      "https://npub.cash/api/v2/auth/nip98?canWithdraw=true",
    );
  });

  test("uses the connection protocol when there is no proxy header", () => {
    expect(getPublicRequestUrl(createRequest()).protocol).toBe("http:");
    expect(
      getPublicRequestUrl(createRequest({ encrypted: true })).protocol,
    ).toBe("https:");
  });

  test("matches normalized hostnames against an optional allowlist", () => {
    const req = createRequest({
      host: "NPUB.CASH:443",
      forwardedProtocol: "https",
    });
    expect(getPublicRequestUrl(req, ["npub.cash"]).hostname).toBe("npub.cash");

    expect(() =>
      getPublicRequestUrl(createRequest({ host: "other.example" }), [
        "npub.cash",
      ]),
    ).toThrow("Host is not allowed");
  });

  test("rejects missing or malformed request context", () => {
    expect(() => getPublicRequestUrl(createRequest({ host: "" }))).toThrow(
      "Missing Host header",
    );
    expect(() =>
      getPublicRequestUrl(createRequest({ forwardedProtocol: "ftp" })),
    ).toThrow("Invalid forwarded protocol");
    expect(() =>
      getPublicRequestUrl(createRequest({ host: "npub.cash/path" })),
    ).toThrow("Invalid Host header");
  });

  test("derives the WebSocket challenge URL from the upgrade request", () => {
    const req = createRequest({
      url: "/api/v2/ws/quote",
      forwardedProtocol: "https",
    });
    expect(getPublicWebSocketUrl(req).toString()).toBe(
      "wss://npub.cash/api/v2/ws/quote",
    );
  });
});
