import { afterAll, beforeAll, expect, test } from "bun:test";
import type { NextFunction, Request, Response } from "express";
import { nip19 } from "nostr-tools";

process.env.MINTURL ??= "https://mint.example.com";
process.env.JWT_SECRET ??= "test-jwt-secret";

const { SqliteAdapter } = await import("@/database/sqliteAdapter");
const { runMigrations } = await import("@/migrations");
const { createRepositories } = await import(
  "@/infrastructure/db/repositoryFactory"
);
const { getCommunicatorService, initializeAppServices } = await import("@/config");
const { eventBus } = await import("@/events");
const { RecipientUnavailableError } = await import("@/errors");
const { lnurlController } = await import("./lnurlController");

const blockedPubkey = "67".repeat(32);
const blockedNpub = nip19.npubEncode(blockedPubkey);
const adapter = new SqliteAdapter(":memory:");

beforeAll(async () => {
  await runMigrations(adapter);
  await adapter.query(
    "INSERT INTO recipient_blocks (pubkey, reason) VALUES (?, ?)",
    [blockedPubkey, "internal only"],
  );
  await adapter.query(
    "INSERT INTO l_users (pubkey, name, mint_url) VALUES (?, ?, ?)",
    [blockedPubkey, "blocked-alias", "http://127.0.0.1:1"],
  );
  await initializeAppServices(
    createRepositories(adapter, { mintUrl: "https://mint.example.com" }),
  );
});

afterAll(async () => {
  await adapter.close();
});

type LnurlRequest = Request<
  { user: string },
  unknown,
  unknown,
  { amount?: string; nostr?: string }
>;

function createRequest(
  amount?: string,
  user: string = blockedNpub,
): LnurlRequest {
  return {
    headers: { host: "npub.cash" },
    socket: {},
    originalUrl: `/.well-known/lnurlp/${user}`,
    params: { user },
    query: amount === undefined ? {} : { amount },
    reqId: "request-1",
  } as unknown as LnurlRequest;
}

function createResponse(recordPayload: (payload: unknown) => void): Response {
  return {
    json(payload: unknown) {
      recordPayload(payload);
      return this;
    },
  } as unknown as Response;
}

async function invokeController(
  amount?: string,
  user?: string,
): Promise<{ error: unknown; payload: unknown }> {
  let nextError: unknown;
  let payload: unknown;
  await lnurlController(
    createRequest(amount, user),
    createResponse((body) => {
      payload = body;
    }),
    ((error?: unknown) => {
      nextError = error;
    }) as NextFunction,
  );
  return { error: nextError, payload };
}

test("rejects a blocked recipient during LNURL discovery", async () => {
  expect((await invokeController()).error).toBeInstanceOf(
    RecipientUnavailableError,
  );
});

test("rejects a blocked callback before creating a mint quote", async () => {
  expect(
    (await invokeController("1000", "blocked-alias")).error,
  ).toBeInstanceOf(RecipientUnavailableError);
});

test("rejects a username alias for a blocked public key", async () => {
  expect(
    (await invokeController(undefined, "BLOCKED-ALIAS")).error,
  ).toBeInstanceOf(RecipientUnavailableError);
});

test("keeps an unregistered and unblocked npub available for discovery", async () => {
  const result = await invokeController(
    undefined,
    nip19.npubEncode("89".repeat(32)),
  );

  expect(result.error).toBeUndefined();
  expect(result.payload).toEqual(
    expect.objectContaining({
      tag: "payRequest",
      callback: expect.stringContaining("/.well-known/lnurlp/npub1"),
    }),
  );
});

test("publishes a persisted quote and returns despite a failing event listener", async () => {
  const communicator = getCommunicatorService();
  const originalCreateMintQuote = communicator.createMintQuote;
  const quoteId = "created-quote";
  let eventQuoteId: number | undefined;
  let persistedBeforePolling = false;
  let finishPersistenceCheck!: () => void;
  const persistenceChecked = new Promise<void>((resolve) => {
    finishPersistenceCheck = resolve;
  });
  const unsubscribeFailure = eventBus.on("mintQuote.created", async () => {
    throw new Error("listener failed");
  });
  const unsubscribeObservation = eventBus.on(
    "mintQuote.created",
    async (mintQuote) => {
      eventQuoteId = mintQuote.id;
      const persisted = await adapter.query<{ id: number }>(
        "SELECT id FROM mint_quotes WHERE id = ?",
        [mintQuote.id],
      );
      persistedBeforePolling = persisted.rowCount === 1;
      finishPersistenceCheck();
    },
  );
  communicator.createMintQuote = async () => ({
    expiry: Math.floor(Date.now() / 1_000) + 60,
    quote: quoteId,
    request: "lnbc-created",
    state: "UNPAID",
    unit: "sat",
    amount: 1,
    locked: false,
  });
  try {
    const result = await invokeController(
      "1000",
      nip19.npubEncode("89".repeat(32)),
    );
    await persistenceChecked;

    expect(result.error).toBeUndefined();
    expect(result.payload).toEqual({ pr: "lnbc-created", routes: [] });
    expect(persistedBeforePolling).toBe(true);
    expect(eventQuoteId).toBeNumber();
  } finally {
    communicator.createMintQuote = originalCreateMintQuote;
    unsubscribeFailure();
    unsubscribeObservation();
  }
});
