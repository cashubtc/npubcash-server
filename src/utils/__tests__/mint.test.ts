import { afterEach, describe, expect, test } from "vitest";
import {
  cashuWalletMap,
  clearWalletCache,
  getWalletFromCache,
  isValidMint,
} from "../mint";
import { CashuMint, CashuWallet } from "@cashu/cashu-ts";

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

describe("Mint cache", () => {
  afterEach(() => {
    clearWalletCache();
  });
  test("Get a stored mint from cache", () => {
    const url = "https://mint.minibits.cash/Bitcoin";
    const newMint = new CashuWallet(new CashuMint(url));
    cashuWalletMap[url] = newMint;
    const cachedWallet = getWalletFromCache(url);
    expect(cachedWallet).toBe(newMint);
  });
  test("clearing wallet cache", () => {
    const url = "https://mint.minibits.cash/Bitcoin";
    const newMint = new CashuWallet(new CashuMint(url));
    cashuWalletMap[url] = newMint;
    expect(Object.keys(cashuWalletMap).length).toBe(1);
    clearWalletCache();
    expect(Object.keys(cashuWalletMap).length).toBe(0);
  });
  test("Adding 2 mints to cache", () => {
    getWalletFromCache("https://mint.minibits.cash/Bitcoin");
    expect(Object.keys(cashuWalletMap).length).toBe(1);
    getWalletFromCache("https://mint.macadamia.cash");
    expect(Object.keys(cashuWalletMap).length).toBe(2);
    getWalletFromCache("https://mint.macadamia.cash");
    expect(Object.keys(cashuWalletMap).length).toBe(2);
  });
});
