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
