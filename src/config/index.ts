import { SimplePool } from "nostr-tools/pool";
import { getPublicKey } from "nostr-tools/pure";
import { accountFromSeedWords } from "nostr-tools/nip06";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";

function getEnvVar(key: string) {
  return process.env[key];
}

class ZapKeys {
  private _secretKey: Uint8Array;
  private _publicKey: string;

  constructor(secretKey: Uint8Array) {
    this._secretKey = secretKey;
    this._publicKey = getPublicKey(secretKey);
  }

  get secretKey() {
    return this._secretKey;
  }

  get publicKey() {
    return this._publicKey;
  }
}

type NostrConfigInit =
  | { nostrEnabled: false }
  | { nostrEnabled: true; zapKeys: ZapKeys; defaultRelays: string[] };

class NostrConfig {
  private _nostrEnabled: boolean;
  private _zapKeys?: ZapKeys;
  private _nostrPool?: SimplePool;
  private _defaultRelays?: string[];

  constructor(config: NostrConfigInit) {
    if (config.nostrEnabled) {
      this._nostrEnabled = true;
      this._zapKeys = config.zapKeys;
      this._nostrPool = new SimplePool();
      this._defaultRelays = config.defaultRelays;
    } else {
      this._nostrEnabled = false;
    }
  }
  get nostrEnabled() {
    return this._nostrEnabled;
  }
  get zapKeys() {
    return this._zapKeys;
  }
  get pool() {
    return this._nostrPool;
  }

  get defaultRelays() {
    return this._defaultRelays;
  }
}

export class AppConfig {
  private jwtSecret: string;
  private nostr: NostrConfig;

  constructor() {
    if (getEnvVar("NOSTR_ENABLED")) {
      const secretKey = getSecretKeyFromEnv();
      const defaultRelays = getRelaysFromEnv();
      this.nostr = new NostrConfig({
        nostrEnabled: true,
        zapKeys: new ZapKeys(secretKey),
        defaultRelays,
      });
    } else {
      this.nostr = new NostrConfig({ nostrEnabled: false });
    }
    this.jwtSecret = getJwtSecretFromEnv();
  }
}

function getRelaysFromEnv() {
  const relays = getEnvVar("DEFAULT_RELAYS");
  if (!relays || !relays.length) {
    throw new Error("No default relays found in env");
  }
  return relays.split(",");
}

function getSecretKeyFromEnv() {
  const envSecretKey = getEnvVar("ZAP_SECRET_KEY");
  if (envSecretKey) {
    return Buffer.from(envSecretKey, "hex");
  }
  const envMnemonic = getEnvVar("MNEMONIC");
  if (!envMnemonic) {
    throw new Error("Could not find ZAP_SECRET_KEY or MNEMONIC in env");
  }
  return accountFromSeedWords(envMnemonic).privateKey;
}

function getJwtSecretFromEnv() {
  const envJwtSecret = getEnvVar("JWT_SECRET");
  if (envJwtSecret) {
    return envJwtSecret;
  }
  const envMnemonic = getEnvVar("MNEMONIC");
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
