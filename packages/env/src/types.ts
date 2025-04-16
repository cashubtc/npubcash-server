const envVarKeys = {
  PG_CONNECTIONSTRING: "",
  MNEMONIC: "",
  HOSTNAME: "",
  MINTURL: "",
  LNURL_MIN_AMOUNT: "",
  LNURL_MAX_AMOUNT: "",
  NOSTR_ENABLED: "",
  DEFAULT_RELAYS: "",
  DEFAULT_MINT: "",
} as const;

export type EnvVarKeys = keyof typeof envVarKeys;
export type EnvVars = Map<EnvVarKeys, string>;
