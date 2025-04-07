import { Router } from "express";
import authRouter from "./authRoutes";
import walletRouter from "./walletRoutes";
import userRouter from "./userRoutes";

const v2Router = Router();

v2Router.use("/auth", authRouter);
v2Router.use("/wallet", walletRouter);
v2Router.use("/user", userRouter);

export default v2Router;
