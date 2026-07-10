import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  getEnvVar,
  getPortFromEnv,
  getMintUrlFromEnv,
  getHostnameFromEnv,
  getNodeEnvFromEnv,
  getLogLevelFromEnv,
  getApiModeFromEnv,
  getDbTypeFromEnv,
  getDbConnectionStringFromEnv,
  getUsernameConfigFromEnv,
  getRelaysFromEnv,
  getParsedMnemonicFromEnv,
  getJwtSecretFromEnv,
  getSecretKeyFromEnv,
} from "./env";

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("env.ts", () => {
  test("getEnvVar returns value or undefined", () => {
    process.env.TEST_VAR = "test_value";
    expect(getEnvVar("TEST_VAR")).toBe("test_value");
    expect(getEnvVar("NONEXISTENT")).toBeUndefined();
  });

  test("getPortFromEnv defaults to 8000, parses number, throws on invalid", () => {
    delete process.env.PORT;
    expect(getPortFromEnv()).toBe(8000);

    process.env.PORT = "3000";
    expect(getPortFromEnv()).toBe(3000);

    process.env.PORT = "invalid";
    expect(() => getPortFromEnv()).toThrow("PORT must be a number");
  });

  test("getMintUrlFromEnv requires MINTURL", () => {
    process.env.MINTURL = "https://mint.example.com";
    expect(getMintUrlFromEnv()).toBe("https://mint.example.com");

    delete process.env.MINTURL;
    expect(() => getMintUrlFromEnv()).toThrow("MINTURL is required");
  });

  test("getHostnameFromEnv requires HOSTNAME", () => {
    process.env.HOSTNAME = "https://npub.cash";
    expect(getHostnameFromEnv()).toBe("https://npub.cash");

    delete process.env.HOSTNAME;
    expect(() => getHostnameFromEnv()).toThrow("HOSTNAME is required");
  });

  test("getNodeEnvFromEnv defaults to development", () => {
    delete process.env.NODE_ENV;
    expect(getNodeEnvFromEnv()).toBe("development");

    process.env.NODE_ENV = "production";
    expect(getNodeEnvFromEnv()).toBe("production");

    process.env.NODE_ENV = "test";
    expect(getNodeEnvFromEnv()).toBe("test");

    process.env.NODE_ENV = "invalid";
    expect(getNodeEnvFromEnv()).toBe("development");
  });

  test("getLogLevelFromEnv defaults to info", () => {
    delete process.env.LOG_LEVEL;
    expect(getLogLevelFromEnv()).toBe("info");

    process.env.LOG_LEVEL = "debug";
    expect(getLogLevelFromEnv()).toBe("debug");
  });

  test("getApiModeFromEnv defaults to BOTH", () => {
    delete process.env.API_MODE;
    expect(getApiModeFromEnv()).toBe("BOTH");

    process.env.API_MODE = "API_ONLY";
    expect(getApiModeFromEnv()).toBe("API_ONLY");
  });

  test("getDbTypeFromEnv defaults to sqlite and infers postgres URLs", () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_TYPE;
    delete process.env.DATABASE_URL;
    expect(getDbTypeFromEnv()).toBe("sqlite");

    process.env.DATABASE_TYPE = "postgres";
    expect(getDbTypeFromEnv()).toBe("postgres");

    delete process.env.DATABASE_TYPE;
    process.env.DATABASE_URL = "postgres://localhost/db";
    expect(getDbTypeFromEnv()).toBe("postgres");

    process.env.DATABASE_URL = "postgresql://localhost/db";
    expect(getDbTypeFromEnv()).toBe("postgres");

    process.env.DATABASE_URL = "./data.db";
    expect(getDbTypeFromEnv()).toBe("sqlite");
  });

  test("getDbTypeFromEnv rejects invalid types and URL mismatches", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_TYPE = "mysql";
    expect(() => getDbTypeFromEnv()).toThrow(
      "DATABASE_TYPE must be either 'postgres' or 'sqlite'",
    );

    process.env.DATABASE_TYPE = "sqlite";
    process.env.DATABASE_URL = "postgres://localhost/db";
    expect(() => getDbTypeFromEnv()).toThrow(
      "DATABASE_TYPE=sqlite does not match DATABASE_URL (postgres)",
    );

    process.env.DATABASE_TYPE = "postgres";
    process.env.DATABASE_URL = "./data.db";
    expect(() => getDbTypeFromEnv()).toThrow(
      "DATABASE_TYPE=postgres does not match DATABASE_URL (sqlite)",
    );

    delete process.env.DATABASE_TYPE;
    process.env.DATABASE_URL = "mysql://localhost/db";
    expect(() => getDbTypeFromEnv()).toThrow(
      "DATABASE_URL must be a PostgreSQL URL or a SQLite file path",
    );
  });

  test("getDbConnectionStringFromEnv returns URL or default SQLite path", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgres://localhost/db";
    expect(getDbConnectionStringFromEnv()).toBe("postgres://localhost/db");

    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_TYPE;
    process.env.NODE_ENV = "development";
    expect(getDbConnectionStringFromEnv()).toBe("./data.db");
  });

  test("getDbConnectionStringFromEnv requires a database choice in production", () => {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_TYPE;
    process.env.NODE_ENV = "production";
    expect(() => getDbConnectionStringFromEnv()).toThrow(
      "Production requires DATABASE_URL or explicit DATABASE_TYPE=sqlite",
    );

    process.env.DATABASE_TYPE = "sqlite";
    expect(getDbConnectionStringFromEnv()).toBe("/data/npubcash.db");

    process.env.DATABASE_TYPE = "postgres";
    process.env.DATABASE_URL = "postgres://localhost/db";
    expect(getDbTypeFromEnv()).toBe("postgres");
    expect(getDbConnectionStringFromEnv()).toBe("postgres://localhost/db");

    delete process.env.DATABASE_URL;
    expect(() => getDbConnectionStringFromEnv()).toThrow(
      "Could not find DATABASE_URL",
    );
  });

  test("getUsernameConfigFromEnv returns enabled/disabled config", () => {
    delete process.env.USERNAME_MINT;
    expect(getUsernameConfigFromEnv()).toEqual({ enabled: false });

    process.env.USERNAME_MINT = "https://mint.example.com";
    process.env.USERNAME_COST = "1000";
    expect(getUsernameConfigFromEnv()).toEqual({
      enabled: true,
      mintUrl: "https://mint.example.com",
      amount: 1000,
    });
  });

  test("getRelaysFromEnv parses comma-separated relays", () => {
    process.env.DEFAULT_RELAYS = "wss://relay1.com,wss://relay2.com";
    expect(getRelaysFromEnv()).toEqual(["wss://relay1.com", "wss://relay2.com"]);

    delete process.env.DEFAULT_RELAYS;
    expect(() => getRelaysFromEnv()).toThrow("No default relays found");
  });

  test("getParsedMnemonicFromEnv converts commas to spaces", () => {
    process.env.MNEMONIC = "word1,word2,word3";
    expect(getParsedMnemonicFromEnv()).toBe("word1 word2 word3");

    delete process.env.MNEMONIC;
    expect(() => getParsedMnemonicFromEnv()).toThrow("Could not find MNEMONIC");
  });

  test("getJwtSecretFromEnv uses direct value or derives from mnemonic", () => {
    process.env.JWT_SECRET = "my-secret";
    expect(getJwtSecretFromEnv()).toBe("my-secret");

    delete process.env.JWT_SECRET;
    process.env.MNEMONIC = "abandon,abandon,abandon,abandon,abandon,abandon,abandon,abandon,abandon,abandon,abandon,about";
    const derived = getJwtSecretFromEnv();
    expect(derived.length).toBe(64);

    delete process.env.MNEMONIC;
    expect(() => getJwtSecretFromEnv()).toThrow("Could not find MNEMONIC");
  });

  test("getSecretKeyFromEnv uses hex value or derives from mnemonic", () => {
    process.env.ZAP_SECRET_KEY = "0".repeat(64);
    expect(getSecretKeyFromEnv().length).toBe(32);

    delete process.env.ZAP_SECRET_KEY;
    process.env.MNEMONIC = "abandon,abandon,abandon,abandon,abandon,abandon,abandon,abandon,abandon,abandon,abandon,about";
    expect(getSecretKeyFromEnv().length).toBe(32);

    delete process.env.MNEMONIC;
    expect(() => getSecretKeyFromEnv()).toThrow("Could not find MNEMONIC");
  });
});
