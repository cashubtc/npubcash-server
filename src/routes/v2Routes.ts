import { Router } from "express";
import { GetClaimsController } from "../controller/v2/claimController";
import { isAuthMiddleware } from "../middleware/auth";
import { getBalanceController } from "../controller/v2/balanceController";

const v2Routes = Router();

v2Routes.get(
  "/claim",
  isAuthMiddleware("/api/v2/claim", "GET"),
  GetClaimsController,
);
v2Routes.get(
  "/balance",
  isAuthMiddleware("/api/v2/balance", "GET"),
  getBalanceController,
);

export default v2Routes;
