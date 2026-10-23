import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { finalizeEvent } from "nostr-tools";
import { NostrConfig, ZapKeys } from "../config/nostr";

process.env.MINTURL ??= "https://mint.example.com";
process.env.JWT_SECRET ??= "test-jwt-secret";

const { config } = await import("../config/index");
const { nostrPool } = await import("../config");
const { handleZapRequest } = await import("./nostr");

const originalNostrConfig = config.nostr;
const defaultRelays = ["wss://default.example.com"];
const secretKey = new Uint8Array(32).fill(1);
let publish: ReturnType<typeof spyOn<typeof nostrPool, "publish">>;

beforeEach(() => {
  Object.defineProperty(config, "nostr", {
    value: new NostrConfig({
      nostrEnabled: true,
      zapKeys: new ZapKeys(secretKey),
      defaultRelays,
    }),
  });
  publish = spyOn(nostrPool, "publish").mockImplementation((relays) =>
    relays.map(() => Promise.resolve("accepted")),
  );
});

afterEach(() => {
  publish.mockRestore();
  Object.defineProperty(config, "nostr", { value: originalNostrConfig });
});

for (const { name, relayTag, expectedRelays } of [
  {
    name: "publishes receipts to the request relays",
    relayTag: ["relays", "wss://first.example.com", "wss://second.example.com"],
    expectedRelays: ["wss://first.example.com", "wss://second.example.com"],
  },
  {
    name: "publishes receipts to default relays when the relays tag is omitted",
    relayTag: undefined,
    expectedRelays: defaultRelays,
  },
  {
    name: "publishes receipts to default relays when the relays tag is empty",
    relayTag: ["relays"],
    expectedRelays: defaultRelays,
  },
]) {
  test(name, async () => {
    const request = finalizeEvent(
      {
        kind: 9734,
        created_at: 1_700_000_000,
        content: "Zap!",
        tags: [
          ["p", "02".repeat(32)],
          ["amount", "21000"],
          ...(relayTag ? [relayTag] : []),
        ],
      },
      secretKey,
    );

    await handleZapRequest("quote-1", request, "test-invoice");

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expectedRelays,
      expect.objectContaining({ kind: 9735 }),
    );
  });
}
