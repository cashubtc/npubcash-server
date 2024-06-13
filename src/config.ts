import { SimplePool, getPublicKey } from "nostr-tools";
import { CashuMint, CashuWallet } from "@cashu/cashu-ts";
import { LightningHandler } from "./utils/lightning";
import { BlinkProvider } from "./utils/blink";

export const wallet = new CashuWallet(new CashuMint(process.env.MINTURL!));
export const lnProvider = new LightningHandler(new BlinkProvider());
export const nostrPool = new SimplePool();

export let ZAP_PUBKEY: string;
if (process.env.ZAP_SECRET_KEY) {
  ZAP_PUBKEY = getPublicKey(Buffer.from(process.env.ZAP_SECRET_KEY, "hex"));
}
