import { expect, test } from "bun:test";
import { createProviderInfo } from "./providerInfo";

test("advertises enabled username payment terms", () => {
  expect(
    createProviderInfo({
      enabled: true,
      amount: 5000,
      mintUrl: "https://mint.example.com",
    }),
  ).toEqual({
    version: 2,
    features: {
      username: {
        enabled: true,
        payment: {
          amount: 5000,
          unit: "sat",
          mints: ["https://mint.example.com"],
        },
      },
    },
  });
});

test("advertises a disabled username feature without payment terms", () => {
  expect(createProviderInfo({ enabled: false })).toEqual({
    version: 2,
    features: {
      username: { enabled: false },
    },
  });
});
