import { describe, test, expect, mock, beforeEach } from "bun:test";
import type { MintQuoteMonitor } from "@/domain/mintQuoteMonitor/MintQuoteMonitor";
import { getEncodedToken, getEncodedTokenV4, createRandomSecretKey, createRandomRawBlindedMessage, type Token, getDecodedToken } from "@cashu/cashu-ts";

// Break the import cycle CommunicatorService → @/config/index → config.ts → CommunicatorService
mock.module("@/config/index", () => ({
  config: { nostr: { nostrEnabled: false } },
}));
mock.module("@/utils/nostr", () => ({
  handleZapRequest: () => Promise.resolve(),
}));
mock.module("@/events", () => ({
  eventBus: { on: () => {}, emit: () => {} },
}));
mock.module("@/utils/logger", () => ({
  logger: { info: () => {}, debug: () => {}, error: () => {} },
}));

// V4 token decode fix: mint.getKeys() (no args) must be used ONCE per mint,
// and the keys (per keyset) must be handed to the Wallet keyset cache. No per-keyset loop.
const getKeysMock = mock(() =>
  Promise.resolve({
    keysets: [
      { id: "ks_sat", unit: "sat", active: true, keys: { 1: "pubkey1", 2: "pubkey2" } },
      { id: "ks_usd", unit: "usd", active: false, keys: { 1: "pubkey3" } },
    ],
  }),
);
const getInfoMock = mock(() => Promise.resolve({ name: "test mint" }));
const receiveMock = mock((token: Token) => Promise.resolve({ token }));

const loadCacheCalls: unknown[] = [];

mock.module("@cashu/cashu-ts", () => ({
  Mint: class {
    constructor(public url: string) {}
    getInfo = getInfoMock;
    getKeys = getKeysMock;
  },
  Wallet: class {
    loadMintFromCache = mock((_info: unknown, cache: unknown) => {
      loadCacheCalls.push(cache);
    });
    receive = receiveMock;
  },
}));

const fakeRepo = {} as unknown as MintQuoteMonitor;

describe("CommunicatorService.redeemToken (V4 token decoding)", () => {
  beforeEach(() => {
    getKeysMock.mockClear();
    receiveMock.mockClear();
  });

  test("keysets fetched in ONE getKeys() call, keys included — no per-keyset loop", async () => {
    const { CommunicatorService } = await import("./CommunicatorService");
    const svc = new CommunicatorService(fakeRepo);

    const token = { mint: "https://mint.example", proofs: [] } as unknown as Token;
    await svc.redeemToken(token);

    // The fix: single call, no keyset-id argument
    expect(getKeysMock).toHaveBeenCalledTimes(1);
    expect(getKeysMock.mock.calls[0]!.length).toBe(0);

    // Wallet.receive gets the exact token
    expect(receiveMock).toHaveBeenCalledWith(token);
  });

  test("wallet cached per mint — second redeem reuses keysets without re-fetching", async () => {
    const { CommunicatorService } = await import("./CommunicatorService");
    const svc = new CommunicatorService(fakeRepo);

    const token = { mint: "https://mint.example", proofs: [] } as unknown as Token;
    await svc.redeemToken(token);
    await svc.redeemToken(token);

    expect(getKeysMock).toHaveBeenCalledTimes(1); // cached after first call
    expect(receiveMock).toHaveBeenCalledTimes(2);
  });

  test("keyset cache handed to Wallet includes keys from the single getKeys call", async () => {
    const { CommunicatorService } = await import("./CommunicatorService");
    const svc = new CommunicatorService(fakeRepo);

    const token = { mint: "https://mint.example", proofs: [] } as unknown as Token;
    await svc.redeemToken(token);

    const cache = loadCacheCalls[0];

    expect(cache).toEqual({
      mintUrl: "https://mint.example",
      unit: "sat",
      keysets: [
        { id: "ks_sat", unit: "sat", active: true, keys: { 1: "pubkey1", 2: "pubkey2" } },
        { id: "ks_usd", unit: "usd", active: false, keys: { 1: "pubkey3" } },
      ],
    });
  });

  test("decode v3/v4 token both", async () => {
    const keyId = "0100aabbccddeeff0011223344556677";
    const { B_ } = createRandomRawBlindedMessage();
    const C = B_.toHex();
    const secret = Buffer.from(createRandomSecretKey()).toString("hex");

    const mock_token = {
      mint: "https://mint.example", proofs: [{
        id: keyId,
        amount: 1,
        secret: secret,
        C: C
      }]
    }
    const keysets = [ keyId ];
    const v3 = getEncodedToken(mock_token, { version: 3 });
    const v4 = getEncodedTokenV4(mock_token);
    const decoded4 = getDecodedToken(v4, keysets);

    //decode both
    expect(getDecodedToken(v3, keysets).proofs[0].id).toBe(keyId);
    expect(decoded4.proofs[0].id).toBe(keyId);

    //throw when no keysets provided
    expect(() => getDecodedToken(v3)).toThrow();
    expect(() => getDecodedToken(v4)).toThrow();

    //check deceded correctly
    expect(decoded4.proofs[0].amount).toBe(1);
    expect(decoded4.unit).toBe("sat");
  });
});
