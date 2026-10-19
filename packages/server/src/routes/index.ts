import { Router } from "express";
import v2Router from "./v2";
import { nip05Controller } from "@/controller/nip05Controller";
import { lnurlController } from "@/controller/lnurlController";
import { lnurlVerifyController } from "@/controller/lnurlVerifyController";

const baseRouter = Router();

baseRouter.get("/.well-known/lnurlp/:user", lnurlController);
baseRouter.get("/lnurl/verify/:token", lnurlVerifyController);
baseRouter.get("/.well-known/nostr.json", nip05Controller);
baseRouter.use("/api/v2", v2Router);

export default baseRouter;
