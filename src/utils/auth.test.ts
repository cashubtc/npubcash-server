import { describe, expect, test } from "@jest/globals";
import { parseInvoice } from "./lightning";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
} from "nostr-tools";
import { verifyAuth } from "./auth";

const sk = generateSecretKey();

const valid = {
  content: "",
  kind: 27235,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ["u", "https://domain.com/path"],
    ["method", "GET"],
  ],
};
const timedOut = {
  content: "",
  kind: 27235,
  created_at: Math.floor(Date.now() / 1000) - 3600,
  tags: [
    ["u", "https://domain.com/path"],
    ["method", "GET"],
  ],
};

const invalid = {
  id: "123",
  pubkey: getPublicKey(sk),
  sig: "123",
  content: "",
  kind: 27235,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ["u", "https://domain.com/path"],
    ["method", "GET"],
  ],
};

describe("Verifying auth header", () => {
  test("Valid auth header", async () => {
    const signedEvent = finalizeEvent(valid, sk);
    const authHeader = `Nostr ${btoa(JSON.stringify(signedEvent))}`;
    const isValid = await verifyAuth(
      authHeader,
      "https://domain.com/path",
      "GET",
    );
    expect(isValid).toMatchObject({
      authorized: true,
      data: {
        pubkey: getPublicKey(sk),
        npub: nip19.npubEncode(getPublicKey(sk)),
      },
    });
  });
  test("Outdated auth header", async () => {
    const signedEvent = finalizeEvent(timedOut, sk);
    const authHeader = `Nostr ${btoa(JSON.stringify(signedEvent))}`;
    const isValid = await verifyAuth(
      authHeader,
      "https://domain.com/path",
      "GET",
    );
    expect(isValid).toEqual({ authorized: false });
  });
  test("Wrong Method", async () => {
    const signedEvent = finalizeEvent(valid, sk);
    const authHeader = `Nostr ${btoa(JSON.stringify(signedEvent))}`;
    const isValid = await verifyAuth(
      authHeader,
      "https://domain.com/path",
      "POST",
    );
    expect(isValid).toEqual({ authorized: false });
  });
  test("Wrong Domain", async () => {
    const signedEvent = finalizeEvent(valid, sk);
    const authHeader = `Nostr ${btoa(JSON.stringify(signedEvent))}`;
    const isValid = await verifyAuth(
      authHeader,
      "https://a-wrong-domain.com/path",
      "GET",
    );
    expect(isValid).toEqual({ authorized: false });
  });
  test("Invalid auth header", async () => {
    const authHeader = `Nostr ${btoa(JSON.stringify(invalid))}`;
    const isValid = await verifyAuth(
      authHeader,
      "https://domain.com/path",
      "GET",
    );
    expect(isValid).toEqual({ authorized: false });
  });
});
