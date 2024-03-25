import { afterEach, describe, expect, test, vi } from "vitest";
import { createLnurlResponse } from "../lnurl";

vi.mock("../../index.ts", () => ({
  get ZAP_PUBKEY() {
    return "123";
  },
}));

describe("Generating LNURL response", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = originalEnv;
  });
  test("Nostr key is set", () => {
    process.env.ZAP_SECRET_KEY = "secret";
    process.env.LNURL_MAX_AMOUNT = "10";
    process.env.LNURL_MIN_AMOUNT = "1";
    process.env.HOSTNAME = "https://npub.cash";
    const host = "https://npub.cash";
    // @ts-ignore
    const response = createLnurlResponse("test", host);
    expect(response).toMatchObject({
      callback: `${host}/.well-known/lnurlp/test`,
      allowsNostr: true,
      maxSendable: 10,
      metadata: '[["text/plain","A cashu lightning address... Neat!"]]',
      minSendable: 1,
      tag: "payRequest",
      nostrPubkey: "123",
    });
  });
  test("Nostr key is not set", () => {
    process.env.LNURL_MAX_AMOUNT = "100";
    process.env.LNURL_MIN_AMOUNT = "10";
    process.env.HOSTNAME = "https://npub.cash";
    const host = "https://npub.cash";
    // @ts-ignore
    const response = createLnurlResponse("test", host);
    expect(response).toMatchObject({
      maxSendable: 100,
      minSendable: 10,
      metadata: '[["text/plain","A cashu lightning address... Neat!"]]',
      tag: "payRequest",
      callback: `${host}/.well-known/lnurlp/test`,
    });
    expect(response).not.toHaveProperty("allowsNostr");
    expect(response).not.toHaveProperty("nostrPubkey");
  });
});
