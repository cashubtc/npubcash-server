import { describe, expect, test } from "vitest";
import { isValidMint } from "../mint";

describe("Verify Mint Url", () => {
  test("Valid Mint URL", async () => {
    const isValid = await isValidMint("https://mint.minibits.cash/Bitcoin");
    expect(isValid).toBe(true);
  });
  test("Invalid URL", async () => {
    const isValid = await isValidMint("Not a url");
    expect(isValid).toBe(false);
  });
  test("Valid URL, but not a mint", async () => {
    const isValid = await isValidMint("https://bitcoin.org");
    expect(isValid).toBe(false);
  });
});
