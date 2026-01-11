import {
  getApiModeFromEnv,
  getDbConnectionStringFromEnv,
  getDbTypeFromEnv,
  getEnvVar,
  getHostnameFromEnv,
  getJwtSecretFromEnv,
  getLogLevelFromEnv,
  getMintUrlFromEnv,
  getNodeEnvFromEnv,
  getPortFromEnv,
  getRelaysFromEnv,
  getSecretKeyFromEnv,
  getUsernameConfigFromEnv,
} from "./env";
import { NostrConfig, ZapKeys } from "./nostr";

function createLnurlLimits() {
  const limits = { min: 1000, max: 100000000 };
  if (process.env.LNURL_MIN_AMOUNT) {
    limits.min = parseInt(process.env.LNURL_MIN_AMOUNT);
  }
  if (process.env.LNURL_MAX_AMOUNT) {
    limits.max = parseInt(process.env.LNURL_MAX_AMOUNT);
  }
  return limits;
}

function createNostrConfig() {
  if (getEnvVar("NOSTR_ENABLED")) {
    return new NostrConfig({
      nostrEnabled: true,
      zapKeys: new ZapKeys(getSecretKeyFromEnv()),
      defaultRelays: getRelaysFromEnv(),
    });
  }
  return new NostrConfig({ nostrEnabled: false });
}

export const config = {
  logLevel: getLogLevelFromEnv(),
  apiMode: getApiModeFromEnv(),
  dbType: getDbTypeFromEnv(),
  dbConnectionString: getDbConnectionStringFromEnv(),
  usernameConfig: getUsernameConfigFromEnv(),
  port: getPortFromEnv(),
  mintUrl: getMintUrlFromEnv(),
  hostname: getHostnameFromEnv(),
  nodeEnv: getNodeEnvFromEnv(),
  nostr: createNostrConfig(),
  jwtSecret: getJwtSecretFromEnv(),
  lnurlLimits: createLnurlLimits(),
} as const;

export type AppConfig = typeof config;
