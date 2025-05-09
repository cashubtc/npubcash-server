import { config } from "dotenv";
import {
  getApiModeFromEnv,
  getDbConnectionStringFromEnv,
  getEnvVar,
  getJwtSecretFromEnv,
  getLogLevelFromEnv,
  getRelaysFromEnv,
  getSecretKeyFromEnv,
} from "./env";
import { NostrConfig, ZapKeys } from "./nostr";
import { resolve } from "path";

export class AppConfig {
  private _logLevel: "info" | "debug";
  private _jwtSecret: string;
  private _nostr: NostrConfig;
  private _lnurlLimits: { min: number; max: number } = {
    min: 1000,
    max: 100000000,
  };
  private _dbConnectionString: string;
  private _apiMode: "BOTH" | "API_ONLY";

  private static instance: AppConfig;

  private constructor() {
    this._logLevel = getLogLevelFromEnv();
    this._apiMode = getApiModeFromEnv();
    this._dbConnectionString = getDbConnectionStringFromEnv();
    if (getEnvVar("NOSTR_ENABLED")) {
      const secretKey = getSecretKeyFromEnv();
      const defaultRelays = getRelaysFromEnv();
      this._nostr = new NostrConfig({
        nostrEnabled: true,
        zapKeys: new ZapKeys(secretKey),
        defaultRelays,
      });
    } else {
      this._nostr = new NostrConfig({ nostrEnabled: false });
    }
    this._jwtSecret = getJwtSecretFromEnv();
    if (process.env.LNURL_MIN_AMOUNT) {
      this._lnurlLimits.min = parseInt(process.env.LNURL_MIN_AMOUNT);
    }
    if (process.env.LNURL_MAX_AMOUNT) {
      this._lnurlLimits.max = parseInt(process.env.LNURL_MAX_AMOUNT);
    }
  }

  get logLevel() {
    return this._logLevel;
  }

  get lnurlLimits() {
    return this._lnurlLimits;
  }

  get dbConnectionString() {
    return this._dbConnectionString;
  }

  get nostr() {
    return this._nostr;
  }

  get jwtSecret() {
    return this._jwtSecret;
  }

  get apiMode() {
    return this._apiMode;
  }

  static init() {
    if (process.env.NODE_ENV !== "production") {
      loadEnvFile();
    } else {
    }
    if (AppConfig.instance) {
      return;
    }
    AppConfig.instance = new AppConfig();
  }

  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.init();
    }
    return AppConfig.instance;
  }
}

export function loadEnvFile() {
  const rootDir = process.env.ROOT_DIR ?? process.cwd();
  const envPath = resolve(rootDir, ".env");
  config({ path: envPath });
}
