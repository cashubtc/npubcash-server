import { Router } from "express";
import { isAuthMiddleware } from "@/middleware/auth";
import { getNip98AuthController } from "@/controller/auth";

const authRouter = Router();

authRouter.get(
  "/nip98",
  isAuthMiddleware(),
  getNip98AuthController,
);

export default authRouter;
