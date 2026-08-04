import { accountFromSeedWords } from "nostr-tools/nip06";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import { DEFAULT_MINT_QUOTE_MONITOR_POLICY } from "@/domain/mintQuoteMonitor/MintQuoteMonitor";

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

type DatabaseType = "postgres" | "sqlite";

function inferDbTypeFromConnectionString(
  connectionString: string | undefined,
): DatabaseType | undefined {
  if (!connectionString) {
    return undefined;
  }
  if (
    connectionString.startsWith("postgres://") ||
    connectionString.startsWith("postgresql://")
  ) {
    return "postgres";
  }
  if (connectionString.includes("://")) {
    throw new Error(
      "DATABASE_URL must be a PostgreSQL URL or a SQLite file path",
    );
  }
  return "sqlite";
}

export function getDbTypeFromEnv(): DatabaseType {
  const explicitType = getEnvVar("DATABASE_TYPE");
  const inferredType = inferDbTypeFromConnectionString(getEnvVar("DATABASE_URL"));

  if (explicitType) {
    if (explicitType !== "postgres" && explicitType !== "sqlite") {
      throw new Error("DATABASE_TYPE must be either 'postgres' or 'sqlite'");
    }
    if (inferredType && inferredType !== explicitType) {
      throw new Error(
        `DATABASE_TYPE=${explicitType} does not match DATABASE_URL (${inferredType})`,
      );
    }
    return explicitType;
  }

  return inferredType ?? "sqlite";
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
    const dbType = getDbTypeFromEnv();
    if (getNodeEnvFromEnv() === "production" && !getEnvVar("DATABASE_TYPE")) {
      throw new Error(
        "Production requires DATABASE_URL or explicit DATABASE_TYPE=sqlite",
      );
    }
    // Default to SQLite file if DATABASE_URL not set
    if (dbType === "sqlite") {
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
  return {
    enabled: true,
    mintUrl: usernameMint,
    amount: parseInt(usernameCost),
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

function getPositiveNumberFromEnv(key: string, fallback: number): number {
  const raw = getEnvVar(key);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} must be a positive number`);
  }
  return value;
}

function getRetryScheduleFromEnv(
  key: string,
  fallback: readonly number[],
): number[] {
  const raw = getEnvVar(key);
  if (raw === undefined) return [...fallback];
  const values = raw.split(",").map((value) => Number(value.trim()));
  if (
    values.length === 0 ||
    values.some((value) => !Number.isFinite(value) || value <= 0)
  ) {
    throw new Error(`${key} must be a comma-separated list of positive numbers`);
  }
  return values;
}

export function getMintQuoteMonitorConfigFromEnv() {
  const jitterRaw = getEnvVar("MINT_QUOTE_RETRY_JITTER_RATIO");
  const jitterRatio =
    jitterRaw === undefined
      ? DEFAULT_MINT_QUOTE_MONITOR_POLICY.jitterRatio
      : Number(jitterRaw);
  if (!Number.isFinite(jitterRatio) || jitterRatio < 0 || jitterRatio > 1) {
    throw new Error("MINT_QUOTE_RETRY_JITTER_RATIO must be between 0 and 1");
  }

  const notFoundInitialMs = getPositiveNumberFromEnv(
    "MINT_QUOTE_NOT_FOUND_INITIAL_MS",
    DEFAULT_MINT_QUOTE_MONITOR_POLICY.notFoundInitialMs,
  );
  const notFoundMaxMs = getPositiveNumberFromEnv(
    "MINT_QUOTE_NOT_FOUND_MAX_MS",
    DEFAULT_MINT_QUOTE_MONITOR_POLICY.notFoundMaxMs,
  );
  if (notFoundMaxMs < notFoundInitialMs) {
    throw new Error(
      "MINT_QUOTE_NOT_FOUND_MAX_MS must be at least MINT_QUOTE_NOT_FOUND_INITIAL_MS",
    );
  }

  return {
    activePollIntervalMs: getPositiveNumberFromEnv(
      "MINT_QUOTE_ACTIVE_POLL_MS",
      DEFAULT_MINT_QUOTE_MONITOR_POLICY.activePollIntervalMs,
    ),
    activeRetryMs: getRetryScheduleFromEnv(
      "MINT_QUOTE_ACTIVE_RETRY_MS",
      DEFAULT_MINT_QUOTE_MONITOR_POLICY.activeRetryMs,
    ),
    reconciliationRetryMs: getRetryScheduleFromEnv(
      "MINT_QUOTE_RECONCILIATION_RETRY_MS",
      DEFAULT_MINT_QUOTE_MONITOR_POLICY.reconciliationRetryMs,
    ),
    notFoundInitialMs,
    notFoundMaxMs,
    jitterRatio,
    requestTimeoutMs: getPositiveNumberFromEnv(
      "MINT_QUOTE_REQUEST_TIMEOUT_MS",
      10_000,
    ),
    periodicReconnectMs: getPositiveNumberFromEnv(
      "MINT_QUOTE_WS_RECONNECT_MS",
      180_000,
    ),
  };
}
