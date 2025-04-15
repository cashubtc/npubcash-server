import { existsSync } from "fs";
import { resolve } from "path";
import {
  getConnectionString,
  getHostname,
  getLnurlLimits,
  getMnemonic,
  getNostrConfig,
  logWelcome,
  writeEnvFile,
} from "./utils";
import { EnvVarKeys } from "./types";

const envVars = new Map<EnvVarKeys, string>();

async function init() {
  const envPath = resolve(process.env.ROOT_DIR!, "./.env");
  const envExists = existsSync(envPath);
  if (envExists) {
    console.log("Env file does already exists. Aborting...");
    process.exit(0);
  }
  console.clear();
  logWelcome();
  const mnemonic = await getMnemonic();
  envVars.set("MNEMONIC", mnemonic);
  console.log("");

  const pgConnectionString = await getConnectionString();
  if (pgConnectionString) {
    envVars.set("PG_CONNECTIONSTRING", pgConnectionString);
  }
  console.log("");

  const hostname = await getHostname();
  envVars.set("HOSTNAME", hostname);
  console.log("");

  const lnurlLimits = await getLnurlLimits();
  envVars.set("LNURL_MAX_AMOUNT", lnurlLimits.max);
  envVars.set("LNURL_MIN_AMOUNT", lnurlLimits.min);
  console.log("");
  const nostrConfig = await getNostrConfig();
  if (nostrConfig.nostrEnabled) {
    envVars.set("NOSTR_ENABLED", "true");
    envVars.set("DEFAULT_RELAYS", nostrConfig.defaultRelays.join(","));
  }
  console.log("");
  writeEnvFile(envVars);
}

init();
