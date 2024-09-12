import { Router } from "express";
import { lnurlController } from "./controller/lnurlController";
import { nip05Controller } from "./controller/nip05Controller";

const routes = Router();

routes.get("/.well-known/lnurlp/:user", lnurlController);
routes.get("/.well-known/nostr.json", nip05Controller);

export default routes;
