import { Router } from "express";
import { lnurlController } from "./controller/lnurlController";
import { paidController } from "./controller/paidController";
import { claimController } from "./controller/claimController";

const routes = Router();

routes.get("/.well-known/lnurlp/:user", lnurlController);
routes.post("/paid", paidController);
routes.get("/claim", claimController);

export default routes;
