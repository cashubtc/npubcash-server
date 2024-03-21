import { afterEach, describe, expect, test } from "vitest";
import {
  createZapReceipt,
  decodeZapRequestParameter,
  extractZapRequestData,
  isValidZapRequestData,
} from "../nostr";
import { generateSecretKey, getPublicKey, validateEvent } from "nostr-tools";

const invalidZapRequest = {
  kind: 9734,
  content: "Zap!",
  tags: [
    [
      "relays",
      "wss://nostr-pub.wellorder.com",
      "wss://anotherrelay.example.com",
    ],
    ["amount", "21000"],
    [
      "lnurl",
      "lnurl1dp68gurn8ghj7um5v93kketj9ehx2amn9uh8wetvdskkkmn0wahz7mrww4excup0dajx2mrv92x9xp",
    ],
    ["p", "04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9"],
    ["p", "04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9"],
    ["e", "9ae37aa68f48645127299e9453eb5d908a0cbb6058ff340d528ed4d37c8994fb"],
  ],
  pubkey: "97c70a44366a6535c145b333f973ea86dfdc2d7a99da618c40c64705ad98e322",
  created_at: 1679673265,
  id: "30efed56a035b2549fcaeec0bf2c1595f9a9b3bb4b1a38abaf8ee9041c4b7d93",
  sig: "f2cb581a84ed10e4dc84937bd98e27acac71ab057255f6aa8dfa561808c981fe8870f4a03c1e3666784d82a9c802d3704e174371aa13d63e2aeaf24ff5374d9d",
};
const zapRequest = {
  kind: 9734,
  content: "Zap!",
  tags: [
    [
      "relays",
      "wss://nostr-pub.wellorder.com",
      "wss://anotherrelay.example.com",
    ],
    ["amount", "21000"],
    [
      "lnurl",
      "lnurl1dp68gurn8ghj7um5v93kketj9ehx2amn9uh8wetvdskkkmn0wahz7mrww4excup0dajx2mrv92x9xp",
    ],
    ["p", "04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9"],
    ["e", "9ae37aa68f48645127299e9453eb5d908a0cbb6058ff340d528ed4d37c8994fb"],
  ],
  pubkey: "97c70a44366a6535c145b333f973ea86dfdc2d7a99da618c40c64705ad98e322",
  created_at: 1679673265,
  id: "30efed56a035b2549fcaeec0bf2c1595f9a9b3bb4b1a38abaf8ee9041c4b7d93",
  sig: "f2cb581a84ed10e4dc84937bd98e27acac71ab057255f6aa8dfa561808c981fe8870f4a03c1e3666784d82a9c802d3704e174371aa13d63e2aeaf24ff5374d9d",
};

describe("Zap Request", () => {
  test("decoding a zap request", () => {
    const encodedRequest = encodeURI(JSON.stringify(zapRequest));
    const decodedRequest = decodeZapRequestParameter(encodedRequest);
    expect(decodedRequest).toEqual(zapRequest);
  });

  test("parsing a zap request", () => {
    const zapRequestData = extractZapRequestData(zapRequest);
    expect(zapRequestData.pTags.length).toBe(1);
    expect(zapRequestData.pTags).toContain(
      "04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9",
    );
    expect(zapRequestData.eTags.length).toBe(1);
    expect(zapRequestData.eTags).toContain(
      "9ae37aa68f48645127299e9453eb5d908a0cbb6058ff340d528ed4d37c8994fb",
    );
    expect(zapRequestData.amount).toBe(21000);
    expect(zapRequestData.relays).toEqual([
      "wss://nostr-pub.wellorder.com",
      "wss://anotherrelay.example.com",
    ]);
  });
  test("validating zap request data", () => {
    const zapRequestData = extractZapRequestData(zapRequest);
    const invalidZapRequestData = extractZapRequestData(invalidZapRequest);
    const isValid = isValidZapRequestData(zapRequestData, 21000);
    const isValid2 = isValidZapRequestData(zapRequestData, 210);
    expect(isValid).toBe(true);
    expect(isValid2).toBe(false);
    const isValid3 = isValidZapRequestData(invalidZapRequestData, 21000);
    expect(isValid3).toBe(false);
  });
});

describe("Zap Receipt", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = originalEnv;
  });
  test("Creating a zap receipt", async () => {
    const skHex = Buffer.from(generateSecretKey()).toString("hex");
    const eTag =
      "fe964e758903360f28d8424d092da8494ed207cba823110be3a57dfe4b578734";
    const pTag =
      "63fe6318dc58583cfe16810f86dd09e18bfd76aabc24a0081ce2856f330504ed";
    const invoice =
      "lnbc15u1p3xnhl2pp5jptserfk3zk4qy42tlucycrfwxhydvlemu9pqr93tuzlv9cc7g3sdqsvfhkcap3xyhx7un8cqzpgxqzjcsp5f8c52y2stc300gl6s4xswtjpc37hrnnr3c9wvtgjfuvqmpm35evq9qyyssqy4lgd8tj637qcjp05rdpxxykjenthxftej7a2zzmwrmrl70fyj9hvj0rewhzj7jfyuwkwcg9g2jpwtk3wkjtwnkdks84hsnu8xps5vsq4gj5hs";
    const now = Math.floor(Date.now() / 1000);
    process.env.ZAP_SECRET_KEY = skHex;

    const receipt = createZapReceipt(now, pTag, eTag, invoice, zapRequest);
    expect(validateEvent(receipt)).toBe(true);
    expect(receipt).toMatchObject({
      pubkey: getPublicKey(Buffer.from(skHex, "hex")),
      tags: [
        ["p", pTag],
        ["P", zapRequest.pubkey],
        ["bolt11", invoice],
        ["description", JSON.stringify(zapRequest)],
        ["e", eTag],
      ],
    });
  });
});
