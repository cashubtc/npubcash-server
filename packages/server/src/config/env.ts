import { accountFromSeedWords } from "nostr-tools/nip06";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";

export function getRelaysFromEnv() {
  const relays = getEnvVar("DEFAULT_RELAYS");
  if (!relays || !relays.length) {
    throw new Error("No default relays found in env");
  }
  return relays.split(",");
}

export function getSecretKeyFromEnv() {
  const envSecretKey = getEnvVar("ZAP_SECRET_KEY");
  if (envSecretKey) {
    return Buffer.from(envSecretKey, "hex");
  }
  const envMnemonic = getParsedMnemonicFromEnv();
  if (!envMnemonic) {
    throw new Error("Could not find ZAP_SECRET_KEY or MNEMONIC in env");
  }
  return accountFromSeedWords(envMnemonic).privateKey;
}

export function getJwtSecretFromEnv() {
  const envJwtSecret = getEnvVar("JWT_SECRET");
  if (envJwtSecret) {
    return envJwtSecret;
  }
  const envMnemonic = getParsedMnemonicFromEnv();
  if (!envMnemonic) {
    throw new Error("Could not find JWT_SECRET or MNEMONIC in env");
  }
  const seed = mnemonicToSeedSync(envMnemonic);
  const entropy = HDKey.fromMasterSeed(seed)
    .derive("m/83696968'/128169'/32'/0'")
    .privateKey?.slice(0, 32);
  if (!entropy) {
    throw new Error("Failed to derive JWT entropy from MNEMONIC");
  }
  return Buffer.from(entropy).toString("hex");
}

export function getDbTypeFromEnv(): "postgres" | "sqlite" {
  const envVar = getEnvVar("DATABASE_TYPE");
  if (envVar === "postgres") {
    return "postgres";
  }
  return "sqlite"; // default
}

function getDefaultSqlitePath(): string {
  if (getNodeEnvFromEnv() === "development") {
    return "./data.db";
  }
  // Production: assume /data volume mount
  return "/data/npubcash.db";
}

export function getDbConnectionStringFromEnv(): string {
  const envVar = getEnvVar("DATABASE_URL");
  if (!envVar) {
    // Default to SQLite file if DATABASE_URL not set
    if (getDbTypeFromEnv() === "sqlite") {
      return getDefaultSqlitePath();
    }
    throw new Error("Could not find DATABASE_URL in env");
  }
  return envVar;
}

export function getParsedMnemonicFromEnv(): string {
  const mnemonic = getEnvVar("MNEMONIC");
  if (!mnemonic) {
    throw new Error("Could not find MNEMONIC in env.");
  }
  return mnemonic.split(",").join(" ");
}

export function getEnvVar(key: string) {
  return process.env[key];
}

export function getApiModeFromEnv(): "BOTH" | "API_ONLY" {
  const apiOnlyString = getEnvVar("API_MODE");
  if (apiOnlyString === "BOTH" || apiOnlyString === "API_ONLY") {
    return apiOnlyString;
  }
  return "BOTH";
}

export function getLogLevelFromEnv(): "debug" | "info" {
  const logLevel = getEnvVar("LOG_LEVEL");
  if (logLevel === "debug") {
    return logLevel;
  }
  return "info";
}

export function getUsernameConfigFromEnv():
  | { enabled: false }
  | { enabled: true; mintUrl: string; amount: number } {
  const usernameMint = getEnvVar("USERNAME_MINT");
  const usernameCost = getEnvVar("USERNAME_COST");
  if (!usernameMint || !usernameCost) {
    return { enabled: false };
  }
  const amount = Number(usernameCost);
  if (!/^\d+$/.test(usernameCost) || !Number.isSafeInteger(amount)) {
    throw new Error("USERNAME_COST must be a non-negative integer");
  }
  return {
    enabled: true,
    mintUrl: usernameMint,
    amount,
  };
}

export function getPortFromEnv(): number {
  const port = getEnvVar("PORT");
  if (!port) return 8000;
  const parsed = parseInt(port, 10);
  if (isNaN(parsed)) throw new Error("PORT must be a number");
  return parsed;
}

export function getMintUrlFromEnv(): string {
  const url = getEnvVar("MINTURL");
  if (!url) throw new Error("MINTURL is required");
  return url;
}

export function getHostnameFromEnv(): string {
  const hostname = getEnvVar("HOSTNAME");
  if (!hostname) throw new Error("HOSTNAME is required");
  return hostname;
}

export function getNodeEnvFromEnv(): "development" | "production" | "test" {
  const env = getEnvVar("NODE_ENV");
  if (env === "production" || env === "test") return env;
  return "development";
}
