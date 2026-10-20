import { afterAll, beforeAll, expect, test } from "bun:test";
import express from "express";
import type { Server } from "http";
import { randomBytes } from "crypto";
import { nip19 } from "nostr-tools";

process.env.MINTURL ??= "https://mint.example.com";
process.env.JWT_SECRET ??= "test-jwt-secret";

const { SqliteAdapter } = await import("@/database/sqliteAdapter");
const { runMigrations } = await import("@/migrations");
const { createRepositories } =
  await import("@/infrastructure/db/repositoryFactory");
const { getCommunicatorService, initializeAppServices } =
  await import("@/config");
const { default: baseRouter } = await import("@/routes");
const { errorHandler } = await import("@/errors/middleware");
const { DefaultQuoteObservationHandler } =
  await import("@/domain/mintQuoteMonitoring/QuoteObservationHandler");

const adapter = new SqliteAdapter(":memory:");
const repositories = createRepositories(adapter, {
  mintUrl: "https://mint.example.com",
});
const pubkey = "ab".repeat(32);
let server: Server;
let origin: string;

beforeAll(async () => {
  await runMigrations(adapter);
  await initializeAppServices(repositories);
  const app = express();
  app.use(baseRouter);
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No HTTP address");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  await adapter.close();
});

async function createQuote() {
  const token = randomBytes(32).toString("hex");
  const quote = await repositories.mintQuoteRepository.create({
    mintUrl: "https://mint.example.com",
    paymentRequest: "lnbc-verification-test",
    unit: "sat",
    quoteId: randomBytes(32).toString("hex"),
    expiresAt: new Date(Date.now() + 60_000),
    amount: 1,
    pubkey,
    locked: false,
    verificationToken: token,
  });
  return { quote, token };
}

test("callback URL verifies payment before and after mint observations", async () => {
  const communicator = getCommunicatorService();
  const original = communicator.createMintQuote;
  const quoteId = randomBytes(32).toString("hex");
  communicator.createMintQuote = async () => ({
    expiry: Math.floor(Date.now() / 1_000) + 60,
    quote: quoteId,
    request: "lnbc-callback",
    state: "UNPAID",
    amount: 1,
    unit: "sat",
    locked: false,
  });
  try {
    const callback = await fetch(
      `${origin}/.well-known/lnurlp/${nip19.npubEncode(pubkey)}?amount=1000`,
      {
        headers: { host: "npub.cash", "x-forwarded-proto": "https" },
      },
    );
    const body = await callback.json();
    expect(body.verify).toMatch(
      /^https:\/\/npub\.cash\/lnurl\/verify\/[0-9a-f]{64}$/,
    );
    expect(body.verify).not.toContain(quoteId);
    const path = new URL(body.verify).pathname;
    const stored =
      await repositories.mintQuoteRepository.getByVerificationToken(
        path.split("/").pop()!,
      );
    expect(stored).toBeDefined();
    const handler = new DefaultQuoteObservationHandler({
      store: repositories.mintQuoteMonitoringStore,
      events: { emit() {} },
    });
    for (const state of ["UNPAID", "PAID", "ISSUED"] as const) {
      await handler.handle({
        source: "websocket",
        mintQuoteId: stored!.id,
        payload: { quote: quoteId, request: body.pr, state },
      });
      const response = await fetch(`${origin}${path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({
        status: "OK",
        settled: state !== "UNPAID",
        preimage: null,
        pr: body.pr,
      });
    }
  } finally {
    communicator.createMintQuote = original;
  }
});

test.each(["UNPAID", "EXPIRED", "INFLIGHT", "PAID", "ISSUED"])(
  "reports persisted %s state even after invoice expiry",
  async (state) => {
    const { quote, token } = await createQuote();
    await adapter.query(
      "UPDATE mint_quotes SET state = ?, expires_at = ? WHERE id = ?",
      [state, new Date(0).toISOString(), quote.id],
    );
    const response = await fetch(`${origin}/lnurl/verify/${token}`);
    expect(await response.json()).toEqual({
      status: "OK",
      settled: state === "PAID" || state === "ISSUED",
      preimage: null,
      pr: quote.paymentRequest,
    });
  },
);

test("does not accept a mint quote ID or a database ID as a verification token", async () => {
  const { quote } = await createQuote();
  for (const token of [
    quote.quoteId,
    String(quote.id),
    "00".repeat(32),
    "invalid",
  ]) {
    const response = await fetch(`${origin}/lnurl/verify/${token}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ERROR",
      reason: "Not found",
    });
  }
});

test("previously issued URLs remain usable after a recipient is blocked", async () => {
  const { quote, token } = await createQuote();
  await adapter.query("INSERT INTO recipient_blocks (pubkey) VALUES (?)", [
    pubkey,
  ]);
  await initializeAppServices(repositories);
  const response = await fetch(`${origin}/lnurl/verify/${token}`);
  expect(await response.json()).toEqual({
    status: "OK",
    settled: false,
    preimage: null,
    pr: quote.paymentRequest,
  });
});

test("repository failures return an LNURL error without exposing internal details", async () => {
  const repository = repositories.mintQuoteRepository;
  const original = repository.getByVerificationToken;
  repository.getByVerificationToken = async () => {
    throw new Error("database unavailable");
  };
  try {
    const response = await fetch(`${origin}/lnurl/verify/${"11".repeat(32)}`);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      status: "ERROR",
      reason: "Service temporarily unavailable.",
    });
  } finally {
    repository.getByVerificationToken = original;
  }
});
