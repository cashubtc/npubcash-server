import { getBalanceHandler } from "@/controller/wallet";
import { isAuthMiddleware } from "@/middleware/auth";
import { Router } from "express";

const walletRouter = Router();

walletRouter.get(
  "/balance",
  isAuthMiddleware("/api/v2/wallet/balance", "GET"),
  getBalanceHandler,
);

export default walletRouter;
