import express from "express";
import bodyparser from "body-parser";
import cors from "cors";
import { CashuMint, CashuWallet } from "@cashu/cashu-ts";
import routes from "./routes";

export const wallet = new CashuWallet(new CashuMint(process.env.MINTURL!));
const app = express();

app.use(bodyparser.json());
app.use(cors());

app.use(routes);

app.listen(process.env.PORT || 8000);
