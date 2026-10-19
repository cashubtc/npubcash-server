import { afterEach, expect, test } from "bun:test";
import type { AuthProvider } from "../src/types";
import { NPCClient } from "../src/client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("provider discovery does not request or send authentication", async () => {
  let authCalls = 0;
  let authorization: string | null = null;
  const authProvider: AuthProvider = {
    async getAuthToken() {
      authCalls += 1;
      return "Bearer unexpected";
    },
    async getNostrToken() {
      return "unused";
    },
  };
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get("Authorization");
    return Response.json({
      error: false,
      data: {
        version: 2,
        features: { username: { enabled: false } },
      },
    });
  };

  const info = await new NPCClient(
    "https://npub.cash",
    authProvider,
  ).getProviderInfo();

  expect(info.features.username).toEqual({ enabled: false });
  expect(authCalls).toBe(0);
  expect(authorization).toBeNull();
});

test("setting a username returns the recipient", async () => {
  const recipient = {
    pubkey: "f".repeat(64),
    name: "alice",
    mintUrl: "https://mint.example",
    lockQuote: false,
  };
  const authProvider: AuthProvider = {
    async getAuthToken() {
      return "Bearer test";
    },
    async getNostrToken() {
      return "unused";
    },
  };
  globalThis.fetch = async () =>
    Response.json({ error: false, data: { user: recipient } });

  const result = await new NPCClient(
    "https://npub.cash",
    authProvider,
  ).setUsername("alice");

  expect(result).toEqual(recipient);
});

test("updating settings returns the recipient", async () => {
  const recipient = {
    pubkey: "f".repeat(64),
    name: "alice",
    mintUrl: "https://new-mint.example",
    lockQuote: true,
  };
  const authProvider: AuthProvider = {
    async getAuthToken() {
      return "Bearer test";
    },
    async getNostrToken() {
      return "unused";
    },
  };
  globalThis.fetch = async () =>
    Response.json({ error: false, data: { user: recipient } });
  const client = new NPCClient("https://npub.cash", authProvider);

  expect(await client.settings.setMintUrl(recipient.mintUrl)).toEqual(
    recipient,
  );
  expect(await client.settings.setLock(true)).toEqual(recipient);
});
