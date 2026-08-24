import { Router } from "express";
import authRouter from "./authRoutes";
import walletRouter from "./walletRoutes";
import userRouter from "./userRoutes";
import { getProviderInfo } from "@/controller/providerInfo";

const v2Router = Router();

v2Router.get("/info", getProviderInfo);
v2Router.use("/auth", authRouter);
v2Router.use("/wallet", walletRouter);
v2Router.use("/user", userRouter);

export default v2Router;
