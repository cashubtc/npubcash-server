import { Router } from "express";
import authRouter from "./authRoutes";
import walletRouter from "./walletRoutes";

const v2Router = Router();

v2Router.use("/auth", authRouter);
v2Router.use("/wallet", walletRouter);

export default v2Router;
