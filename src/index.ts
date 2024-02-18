import express, { Response } from "express";
import bodyparser from "body-parser";
import cors from "cors";
import { CashuMint, CashuWallet } from "@cashu/cashu-ts";

import routes from "./routes";
import { LightningHandler } from "./utils/lightning";
import { BlinkProvider } from "./utils/blink";
import { SimplePool, getPublicKey } from "nostr-tools";
import "websocket-polyfill";
import { checkEnvVars } from "./utils/general";
import path from "path";
import { requireHTTPS } from "./middleware/https";

checkEnvVars(["LNURL_MAX_AMOUNT", "LNURL_MIN_AMOUNT", "MINTURL"]);

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

app.use(requireHTTPS);
app.use(routes);
app.use("/", express.static(path.join(__dirname, "../frontend")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(process.env.PORT || 8000);
