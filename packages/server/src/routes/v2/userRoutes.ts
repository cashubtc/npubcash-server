import { usernameController } from "@/controller/username";
import { isAuthMiddleware } from "@/middleware/auth";
import { Router } from "express";

const userRouter = Router();

userRouter.post(
  "/username",
  isAuthMiddleware("/api/v2/user/username", "POST"),
  usernameController,
);

export default userRouter;
