import { expect, test } from "bun:test";
import { InvalidRecipientError, RecipientUnavailableError } from "@/errors";
import { nip19 } from "nostr-tools";
import { UserWithName } from "./user";
import type { UserRepository } from "./userRepository";

process.env.MINTURL ??= "https://mint.example.com";
process.env.JWT_SECRET ??= "test-jwt-secret";

const { UserService } = await import("./UserService");

function createUserRepository(
  overrides: Partial<UserRepository> = {},
): UserRepository {
  return {
    getUserByPubkey: async () => null,
    getUserByName: async () => null,
    createUser: async () => {},
    upsertUsername: async () => {
      throw new Error("not implemented");
    },
    upsertLockQuote: async () => {},
    saveUser: async () => {},
    ...overrides,
  };
}

test("resolves an uppercase npub to its canonical public key", async () => {
  const pubkey = "01".repeat(32);
  const uppercaseNpub = nip19.npubEncode(pubkey).toUpperCase();
  const service = new UserService(createUserRepository());

  const recipient = await service.extractUserdataFromUserParam(uppercaseNpub);

  expect(recipient.pubkey).toBe(pubkey);
  expect(recipient.isNpub).toBe(true);
});

test("resolves a lowercase npub to its canonical public key", async () => {
  const pubkey = "04".repeat(32);
  const service = new UserService(createUserRepository());

  const recipient = await service.extractUserdataFromUserParam(
    nip19.npubEncode(pubkey),
  );

  expect(recipient.pubkey).toBe(pubkey);
  expect(recipient.isNpub).toBe(true);
});

test("resolves a username beginning with npub when it is not an npub1 value", async () => {
  const user = new UserWithName({
    pubkey: "02".repeat(32),
    name: "npubfoo",
    mintUrl: "https://mint.example.com",
    lockQuote: false,
  });
  const service = new UserService(
    createUserRepository({
      getUserByName: async (name) => (name === "npubfoo" ? user : null),
    }),
  );

  const recipient = await service.extractUserdataFromUserParam("npubfoo");

  expect(recipient.pubkey).toBe(user.pubkey);
  expect(recipient.isNpub).toBe(false);
});

test("rejects a mixed-case npub as an invalid recipient", async () => {
  const npub = nip19.npubEncode("03".repeat(32));
  const mixedCaseNpub = `${npub.slice(0, 8)}${npub[8].toUpperCase()}${npub.slice(9)}`;
  const service = new UserService(createUserRepository());

  expect(
    service.extractUserdataFromUserParam(mixedCaseNpub),
  ).rejects.toBeInstanceOf(InvalidRecipientError);
});

test("rejects an npub with an invalid checksum as an invalid recipient", async () => {
  const npub = nip19.npubEncode("05".repeat(32));
  const invalidNpub = `${npub.slice(0, -1)}${npub.endsWith("q") ? "p" : "q"}`;
  const service = new UserService(createUserRepository());

  expect(
    service.extractUserdataFromUserParam(invalidNpub),
  ).rejects.toBeInstanceOf(InvalidRecipientError);
});

test("reports an unknown username as an unavailable recipient", async () => {
  const service = new UserService(createUserRepository());

  expect(
    service.extractUserdataFromUserParam("missing-user"),
  ).rejects.toBeInstanceOf(RecipientUnavailableError);
});
