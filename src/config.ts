import { SimplePool, getPublicKey } from "nostr-tools";
import { Wallet } from "@cashu/cashu-ts";

export const wallet = new Wallet(process.env.MINTURL!);
export const nostrPool = new SimplePool();

export let ZAP_PUBKEY: string;
if (process.env.ZAP_SECRET_KEY) {
  ZAP_PUBKEY = getPublicKey(Buffer.from(process.env.ZAP_SECRET_KEY, "hex"));
}
