import { Router } from "express";
import { lnurlController } from "./controller/lnurlController";
import { paidController } from "./controller/paidController";
import {
  balanceController,
  claimGetController,
} from "./controller/claimController";
import {
  getInfoController,
  putMintInfoController,
  putUsernameInfoController,
} from "./controller/infoController";
import { isAuthMiddleware } from "./middleware/auth";

const routes = Router();

routes.get("/.well-known/lnurlp/:user", lnurlController);

routes.get(
  "/api/v1/info",
  isAuthMiddleware(`/api/v1/info`, "GET"),
  getInfoController,
);
routes.put(
  "/api/v1/info/mint",
  isAuthMiddleware(`/api/v1/info/mint`, "PUT"),
  putMintInfoController,
);
routes.put(
  "/api/v1/info/username",
  isAuthMiddleware(`/api/v1/info/username`, "PUT"),
  putUsernameInfoController,
);
routes.post("/api/v1/paid", paidController);
routes.get(
  "/api/v1/claim",
  isAuthMiddleware("/api/v1/claim", "GET"),
  claimGetController,
);
routes.get(
  "/api/v1/balance",
  isAuthMiddleware("/api/v1/balance", "GET"),
  balanceController,
);

export default routes;
