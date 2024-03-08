import { beforeEach, describe, expect, test, vi } from "vitest";
import request from "supertest";
import { Claim, Transaction, User } from "../models";
import { app } from "..";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
  nip98,
} from "nostr-tools";

const tx: Transaction = {
  id: 40,
  user: "egge",
  created_at: Math.floor(
    new Date("2024-01-16 12:29:38.500018+00").getTime() / 1000,
  ),
  mint_pr:
    "lnbc100n1pj6va4jpp573n6jn5kqlcc89l9hd97vze3w3qjjwrvyspqhcn8dwm8c6rhgf2sdqdd45ku6tzd968xcqzzsxqrrsssp58jragcrxva0995kpp3mp3j76hdfj8jcx7l83u4ts5c7kttxch3as9qyyssqz0jvl5k2yzzcnwc80e0vtl8jmf5jpp3aj6avqdac3q2vd8utm5g88z60xzzy63hu2ptx8rwu3hw03hydzejepahtp5x4vjkxhz8m27cqhm8yrp",
  mint_hash: "f467a94e9607f18397e5bb4be60b31744129386c24020be2676bb67c68774255",
  server_hash:
    "cec8d5fe7753b9c8183d8afd5cc686885e3ed734fc712f328bfc1d16638e916a",
  server_pr:
    "lnbc100n1pj6va4jpp5emydtlnh2wuusxpa3t74e35x3p0ra4e5l3cj7v5tlsw3vcuwj94qdq4gdshx6r4ypqkgerjv4ehxcqzpuxqyz5vqsp5q5nnatw8ndh3cjkh7uwwuscsyyws8w4vnf52e6j79q8ycyxu0ywq9qyyssqnr0nz84u7k43q9xw3ypg26t30xpv55ygeq80ezlp2aqqjse2ekfya93ud2lg052zeea22t5s5fmqlaf4lsaj5xfnkppy84pmcp2snpqplqh5tl",
  zap_request: null,
  fulfilled: null,
  amount: 21,
};

const body = {
  accountId: "1580f7f2-0e4c-4187-b97f-9ed6eaff8f55",
  eventType: "receive.lightning",
  walletId: "21087d73-80d8-4556-a73a-e1b6b0657784",
  transaction: {
    createdAt: "2023-11-21T01:49:38.375Z",
    id: "655cd1926445716f60b89418",
    initiationVia: {
      paymentHash:
        "bf6b61f814b2e2284f5cbb7c9f9e67887018ffe3f53bedb9b70dec0a15ebca1c",
      pubkey:
        "d75a81acb76fd85dafe491799bbd1940a25e8a8fa776cacccda4ee8444555e3e",
      type: "lightning",
    },
    memo: null,
    settlementAmount: 2707,
    settlementCurrency: "BTC",
    settlementDisplayAmount: "1.00",
    settlementDisplayFee: "0.00",
    settlementDisplayPrice: {
      base: "36941263391",
      displayCurrency: "USD",
      offset: "12",
      walletCurrency: "BTC",
    },
    settlementFee: 0,
    settlementVia: {
      type: "lightning",
    },
    status: "success",
    walletId: "21087d73-80d8-4556-a73a-e1b6b0657784",
  },
};

beforeEach(() => {
  vi.resetModules();
});

describe("GET /info", () => {
  test("Authed Request, no username", async () => {
    vi.spyOn(User, "getUserByPubkey").mockImplementation(async () => undefined);
    const sk = generateSecretKey();
    const authHeader = await nip98.getToken(
      "https://npub.cash/api/v1/info",
      "GET",
      (e) => finalizeEvent(e, sk),
    );
    const res = await request(app)
      .get("/api/v1/info")
      .set("Authorization", authHeader)
      .set("host", "npub.cash")
      .set("X-Forwarded-Proto", "https");
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      username: null,
      npub: nip19.npubEncode(getPublicKey(sk)),
    });
  });

  test("Authed Request, with username", async () => {
    const sk = generateSecretKey();
    vi.spyOn(User, "getUserByPubkey").mockImplementation(async () => ({
      upsertMintByPubkey: async () => {},
      pubkey: "1223",
      name: "egge",
      mint_url: "mint",
    }));
    const authHeader = await nip98.getToken(
      "https://npub.cash/api/v1/info",
      "GET",
      (e) => finalizeEvent(e, sk),
    );
    const res = await request(app)
      .get("/api/v1/info")
      .set("Authorization", authHeader)
      .set("host", "npub.cash")
      .set("X-Forwarded-Proto", "https");
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      username: "egge",
      npub: nip19.npubEncode(getPublicKey(sk)),
    });
  });
});
