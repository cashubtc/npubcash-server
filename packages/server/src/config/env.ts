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

export function getDbConnectionStringFromEnv(): string {
  const envVar = getEnvVar("DATABASE_URL");
  if (!envVar) {
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
