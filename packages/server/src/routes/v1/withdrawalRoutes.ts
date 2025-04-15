import { Router } from "express";
import { isAuthMiddleware } from "@/middleware/auth";
import {
  getLatestWithdrawalsController,
  getWithdrawalDetailsController,
} from "@/controller/withdrawalController";

const withdrawalRouter = Router();

withdrawalRouter.get(
  "/",
  isAuthMiddleware("/api/v1/withdrawals", "GET"),
  getLatestWithdrawalsController,
);

withdrawalRouter.get(
  "/:id",
  isAuthMiddleware("/api/v1/withdrawals/:id", "GET"),
  getWithdrawalDetailsController,
);
