import { getMintQuotes } from "@/controller/wallet";
import { isAuthMiddleware } from "@/middleware/auth";
import { Router } from "express";

const walletRouter = Router();

walletRouter.get(
  "/quotes",
  isAuthMiddleware("/api/v2/wallet/quotes", "GET"),
  getMintQuotes,
);

export default walletRouter;
