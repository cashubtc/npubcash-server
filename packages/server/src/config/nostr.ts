import { SimplePool } from "nostr-tools/pool";
import { getPublicKey } from "nostr-tools/pure";

export type NostrConfigInit =
  | { nostrEnabled: false }
  | { nostrEnabled: true; zapKeys: ZapKeys; defaultRelays: string[] };

export class ZapKeys {
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

export class NostrConfig {
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
    if (!this._zapKeys) {
      throw new Error("No Zap keys are set");
    }
    return this._zapKeys;
  }
  get pool() {
    return this._nostrPool;
  }

  get defaultRelays() {
    if (!this._defaultRelays || !this._defaultRelays.length) {
      throw new Error("No default relays are set");
    }
    return this._defaultRelays;
  }
}
