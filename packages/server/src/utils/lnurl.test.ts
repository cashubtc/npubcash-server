import { expect, test } from "bun:test";

process.env.MINTURL ??= "https://mint.example.com";
process.env.JWT_SECRET ??= "test-jwt-secret";

const { createLnurlResponse } = await import("./lnurl");

test("advertises the LUD-16 identifier for the public origin", () => {
  const response = createLnurlResponse("alice", "https://pay.example.com");

  expect(JSON.parse(response.metadata)).toEqual([
    ["text/plain", "A cashu lightning address... Neat!"],
    ["text/identifier", "alice@pay.example.com"],
  ]);
});

test("normalizes the identifier required by LUD-16 to lowercase", () => {
  const response = createLnurlResponse("NPUB1EXAMPLE", "https://NPUB.CASH");

  expect(JSON.parse(response.metadata)).toContainEqual([
    "text/identifier",
    "npub1example@npub.cash",
  ]);
});
