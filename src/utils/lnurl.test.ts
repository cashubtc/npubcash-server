import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { createLnurlResponse } from "./lnurl";

describe("Generating LNURL response", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = originalEnv;
  });
  test("Nostr key is set", () => {
    process.env.ZAP_SECRET_KEY = "secret";
    process.env.LNURL_MAX_AMOUNT = "10";
    process.env.LNURL_MIN_AMOUNT = "1";
    const host = "https://npub.cash";
    const response = createLnurlResponse("test");
    expect(response.allowsNostr).toBe(true);
    expect(response.maxSendable).toBe(10);
    expect(response.minSendable).toBe(1);
  });
  test("Zap key is not set", () => {
    process.env.LNURL_MAX_AMOUNT = "100";
    process.env.LNURL_MIN_AMOUNT = "10";
    const host = "https://npub.cash";
    const response = createLnurlResponse("test");
    expect(response.allowsNostr).toBeUndefined();
    expect(response.maxSendable).toBe(100);
    expect(response.minSendable).toBe(10);
  });
});
