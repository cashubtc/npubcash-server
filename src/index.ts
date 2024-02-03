import express, { Response } from "express";
import bodyparser from "body-parser";
import cors from "cors";
import { CashuMint, CashuWallet } from "@cashu/cashu-ts";

import routes from "./routes";
import { LightningHandler } from "./utils/lightning";
import { BlinkProvider } from "./utils/blink";
import { SimplePool, getPublicKey } from "nostr-tools";
import "websocket-polyfill";

export const wallet = new CashuWallet(new CashuMint(process.env.MINTURL!));
export const lnProvider = new LightningHandler(new BlinkProvider());
export const nostrPool = new SimplePool();

export let ZAP_PUBKEY: string;
if (process.env.ZAP_SECRET_KEY) {
  ZAP_PUBKEY = getPublicKey(Buffer.from(process.env.ZAP_SECRET_KEY, "hex"));
}

const app = express();

app.use(bodyparser.json());
app.use(cors());
app.use(routes);
app.get("/", (_, res: Response) => {
  res.redirect("https://app.cashu-address.com");
});

app.listen(process.env.PORT || 8000);
