import { Router } from "express";
import v2Router from "./v2";
import { nip05Controller } from "@/controller/nip05Controller";
import { lnurlController } from "@/controller/lnurlController";

const baseRouter = Router();

baseRouter.get("/.well-known/lnurlp/:user", lnurlController);
baseRouter.get("/.well-known/nostr.json", nip05Controller);
baseRouter.use("/api/v2", v2Router);

export default baseRouter;
