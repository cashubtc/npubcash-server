import { afterEach, describe, expect, test, vi } from "vitest";
import { createLnurlResponse } from "../lnurl";
import { generateSecretKey, getPublicKey } from "nostr-tools";
import { ZAP_PUBKEY } from "../../config";

const sk = generateSecretKey();

vi.mock("../../config", async () => {
  return {
    ZAP_PUBKEY:
      "1f81f34debf4577841c3b0f2834f7308eb522d9dd08292f39308bee2f7c07275",
  };
});

describe("Generating LNURL response", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = originalEnv;
  });
  test("Nostr key is set", async () => {
    process.env.ZAP_SECRET_KEY =
      "97b5bf05d654feb9fbc0d615944d94e7139dd0475980952377ba79f799903644";
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
      nostrPubkey: getPublicKey(
        Buffer.from(
          "97b5bf05d654feb9fbc0d615944d94e7139dd0475980952377ba79f799903644",
          "hex",
        ),
      ),
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
