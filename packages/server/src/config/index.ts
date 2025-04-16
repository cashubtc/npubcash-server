import {
  getDbConnectionStringFromEnv,
  getEnvVar,
  getJwtSecretFromEnv,
  getRelaysFromEnv,
  getSecretKeyFromEnv,
} from "./env";
import { NostrConfig, ZapKeys } from "./nostr";

export class AppConfig {
  private jwtSecret: string;
  private _nostr: NostrConfig;
  private _lnurlLimits: { min: number; max: number } = {
    min: 1000,
    max: 100000000,
  };
  private _dbConnectionString: string;

  private static instance: AppConfig;

  private constructor() {
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
    this.jwtSecret = getJwtSecretFromEnv();
    if (process.env.LNURL_MIN_AMOUNT) {
      this._lnurlLimits.min = parseInt(process.env.LNURL_MIN_AMOUNT);
    }
    if (process.env.LNURL_MAX_AMOUNT) {
      this._lnurlLimits.max = parseInt(process.env.LNURL_MAX_AMOUNT);
    }
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

  static init() {
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
