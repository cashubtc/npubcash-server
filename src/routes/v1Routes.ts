import { Router } from "express";
import {
  getInfoController,
  putMintInfoController,
  putUsernameInfoController,
} from "../controller/infoController";
import { paidController } from "../controller/paidController";
import {
  getLatestWithdrawalsController,
  getWithdrawalDetailsController,
} from "../controller/withdrawalController";
import {
  balanceController,
  claimGetController,
} from "../controller/claimController";
import { isAuthMiddleware } from "../middleware/auth";

const v1Routes = Router();

v1Routes.get(
  "/info",
  isAuthMiddleware(`/api/v1/info`, "GET"),
  getInfoController,
);
v1Routes.put(
  "/info/mint",
  isAuthMiddleware(`/api/v1/info/mint`, "PUT"),
  putMintInfoController,
);
v1Routes.put(
  "/info/username",
  isAuthMiddleware(`/api/v1/info/username`, "PUT"),
  putUsernameInfoController,
);
v1Routes.post("/api/v1/paid", paidController);
v1Routes.get(
  "/claim",
  isAuthMiddleware("/api/v1/claim", "GET"),
  claimGetController,
);
v1Routes.get(
  "/balance",
  isAuthMiddleware("/api/v1/balance", "GET"),
  balanceController,
);
v1Routes.get(
  "/withdrawals",
  isAuthMiddleware("/api/v1/withdrawals", "GET"),
  getLatestWithdrawalsController,
);

v1Routes.get(
  "/withdrawals/:id",
  isAuthMiddleware("/api/v1/withdrawals/:id", "GET"),
  getWithdrawalDetailsController,
);

export default v1Routes;
