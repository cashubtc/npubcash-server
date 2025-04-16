import { generateMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import prompts from "prompts";
import { EnvVars } from "./types";
import { resolve } from "path";
import { writeFileSync } from "fs";

export async function getMnemonic(): Promise<string> {
  console.log(
    "npubcash-server requires a seed phrase to operate. It is used to derive several keys and secrets.",
  );
  const { newMnemonic } = await prompts({
    type: "toggle",
    name: "newMnemonic",
    message: "Do you want to import a seedphrase or generate a new one?",
    active: "Generate",
    inactive: "Import",
    initial: true,
  });

  if (newMnemonic) {
    return generateMnemonic(wordlist, 128).split(" ").join(",");
  } else {
    const { userMnemonic } = await prompts({
      type: "text",
      name: "userMnemonic",
      message: "Input your own mnemonic",
      validate: (userMnemonic: string) =>
        validateMnemonic(userMnemonic, wordlist) ? true : "Invalid mnemonic!",
    });
    return userMnemonic.split(" ").join(",");
  }
}
export function logWelcome() {
  const welcomeMessage =
    "Welcome to npubcash-env! This script will help you configure your npubcash-server environment!";
  console.log(welcomeMessage);
  console.log("=".repeat(welcomeMessage.length));
}

export async function getHostname() {
  const { hostname } = await prompts({
    type: "text",
    name: "hostname",
    message:
      "What is the domain / hostname npubcash-server will be running on?",
  });
  return hostname;
}

export async function getNostrConfig(): Promise<
  { nostrEnabled: false } | { nostrEnabled: true; defaultRelays: string[] }
> {
  const { nostrEnabled } = await prompts({
    type: "toggle",
    name: "nostrEnabled",
    message:
      "Do you want to enable nostr / nip-57 zaps on your npubcash-server?",
    active: "Yes",
    inactive: "No",
  });
  if (!nostrEnabled) {
    return { nostrEnabled: false };
  }
  const { defaultRelays } = await prompts({
    type: "list",
    name: "defaultRelays",
    message:
      "Enter the full URLs of relays that should be used (separated by comma)",
  });
  return { nostrEnabled: true, defaultRelays };
}

export async function getLnurlLimits(): Promise<{ min: string; max: string }> {
  const { minAmount } = await prompts({
    type: "number",
    name: "minAmount",
    message:
      "What should the minimum invoice amount allowed by your npubcash-server be? (in sats)",
    initial: 1,
    min: 1,
  });
  const { maxAmount } = await prompts({
    type: "number",
    name: "maxAmount",
    message:
      "What should the minimum invoice amount allowed by your npubcash-server be? (in sats)",
    initial: 100000,
  });
  return { min: String(minAmount), max: String(maxAmount) };
}

export async function getDefaultMint() {
  const { defaultMint } = await prompts({
    type: "text",
    name: "defaultMint",
    message:
      "Please enter the full url of the custom mint that should be used by npubcash-server:",
  });
  return defaultMint;
}

export function writeEnvFile(envVars: EnvVars) {
  const envPath = resolve(process.env.ROOT_DIR!, "./.env");
  const lines: string[] = [];
  envVars.forEach((v, k) => {
    lines.push(`${k}=${v}`);
  });
  writeFileSync(envPath, lines.join("\n"));
}

export async function getConnectionString(): Promise<string | undefined> {
  const { shouldBeSet } = await prompts({
    type: "confirm",
    name: "shouldBeSet",
    message: "Do you want to set a postgres connection string?",
  });
  if (!shouldBeSet) {
    return;
  }
  const { connectionString } = await prompts({
    type: "text",
    name: "connectionString",
    message: "Please enter the postgres connection string: ",
  });
  return connectionString;
}
