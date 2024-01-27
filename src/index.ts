import express, { Request, Response } from "express";
import bodyparser from "body-parser";
import cors from "cors";
import { CashuMint, CashuWallet } from "@cashu/cashu-ts";
import routes from "./routes";
import { LightningHandler } from "./utils/lightning";
import { BlinkProvider } from "./utils/blink";

export const wallet = new CashuWallet(new CashuMint(process.env.MINTURL!));
export const lnProvider = new LightningHandler(new BlinkProvider());

const app = express();

app.use(bodyparser.json());
app.use(cors());
app.use(routes);
app.get("/", (req: Request, res: Response) => {
  res.redirect("https://app.cashu-address.com");
});

app.listen(process.env.PORT || 8000);
