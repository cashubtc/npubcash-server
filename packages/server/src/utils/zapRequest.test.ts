import { expect, test } from "bun:test";
import express from "express";
import { finalizeEvent, nip57 } from "nostr-tools";
import { decodeZapRequestParameter } from "./zapRequest";

const amount = 21_000;

function createZapRequest(content: string) {
  const request = nip57.makeZapRequest({
    pubkey: "02".repeat(32),
    amount,
    relays: ["wss://relay.example.com"],
    comment: content,
  });
  return finalizeEvent(request, new Uint8Array(32).fill(1));
}

test("decodes a standards-compliant framework-decoded zap request", () => {
  const event = createZapRequest("100% compatible, with a literal %20");

  const decoded = decodeZapRequestParameter(JSON.stringify(event));

  expect(decoded.id).toBe(event.id);
  expect(decoded.content).toBe("100% compatible, with a literal %20");
});

test("accepts Primal's double-encoded zap request after query parsing", () => {
  const event = createZapRequest("Zap!");
  const callback = new URL("https://npub.cash/.well-known/lnurlp/example");
  callback.searchParams.set("amount", String(amount));
  callback.searchParams.set(
    "nostr",
    encodeURIComponent(JSON.stringify(event)),
  );

  const receivedNostrParameter = new URL(callback).searchParams.get("nostr")!;
  const decoded = decodeZapRequestParameter(receivedNostrParameter);

  expect(decoded.id).toBe(event.id);
  expect(decoded.content).toBe("Zap!");
});

test("handles standard and Primal query values after Express parsing", () => {
  const app = express();
  const parseQuery = app.get("query parser fn") as (
    query: string,
  ) => Record<string, unknown>;
  const event = createZapRequest("Express integration");
  const serializedEvent = JSON.stringify(event);

  const standardUrl = new URL("https://npub.cash/callback");
  standardUrl.searchParams.set("nostr", serializedEvent);
  const standardValue = parseQuery(standardUrl.search.slice(1)).nostr;

  expect(standardValue).toBe(serializedEvent);
  expect(decodeZapRequestParameter(standardValue as string).id).toBe(event.id);

  const primalValue = encodeURIComponent(serializedEvent);
  const primalUrl = new URL("https://npub.cash/callback");
  primalUrl.searchParams.set("nostr", primalValue);
  const parsedPrimalValue = parseQuery(primalUrl.search.slice(1)).nostr;

  expect(parsedPrimalValue).toBe(primalValue);
  expect(decodeZapRequestParameter(parsedPrimalValue as string).id).toBe(
    event.id,
  );
});
