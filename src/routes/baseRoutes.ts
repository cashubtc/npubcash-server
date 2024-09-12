import { Router } from "express";
import { lnurlController } from "../controller/lnurlController";
import { nip05Controller } from "../controller/nip05Controller";

const baseRoutes = Router();

baseRoutes.get("/.well-known/lnurlp/:user", lnurlController);
baseRoutes.get("/.well-known/nostr.json", nip05Controller);

export default baseRoutes;
