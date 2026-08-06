import { getMintQuotes } from "@/controller/wallet";
import { isAuthMiddleware } from "@/middleware/auth";
import { Router } from "express";

const walletRouter = Router();

walletRouter.get(
  "/quotes",
  isAuthMiddleware(),
  getMintQuotes,
);

export default walletRouter;
