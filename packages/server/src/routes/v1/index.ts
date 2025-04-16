import { Router } from "express";
import infoRouter from "./infoRoutes";
import { paidController } from "@/controller/paidController";
import { isAuthMiddleware } from "@/middleware/auth";
import {
  balanceController,
  claimGetController,
} from "@/controller/claimController";

const v1Router = Router();

v1Router.use("/info", infoRouter);
v1Router.post("/paid", paidController);
v1Router.get(
  "/claim",
  isAuthMiddleware("/api/v1/claim", "GET"),
  claimGetController,
);
v1Router.get(
  "/balance",
  isAuthMiddleware("/api/v1/balance", "GET"),
  balanceController,
);

export default v1Router;
