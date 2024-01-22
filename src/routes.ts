import { Router } from "express";
import { lnurlController } from "./controller/lnurlController";
import { paidController } from "./controller/paidController";
import {
  balanceController,
  claimGetController,
} from "./controller/claimController";
import { getInfoController } from "./controller/infoController";

const routes = Router();

routes.get("/.well-known/lnurlp/:user", lnurlController);
routes.get("/api/v1/info", getInfoController);
routes.post("/api/v1/paid", paidController);
routes.get("/api/v1/claim", claimGetController);
routes.get("/api/v1/balance", balanceController);

export default routes;
