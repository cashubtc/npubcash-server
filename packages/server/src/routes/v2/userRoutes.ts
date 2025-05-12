import { usernameController } from "@/controller/username";
import { updateUserSettingLock } from "@/controller/userSettingsController";
import { isAuthMiddleware } from "@/middleware/auth";
import { Router } from "express";

const userRouter = Router();

userRouter.post(
  "/username",
  isAuthMiddleware("/api/v2/user/username", "POST"),
  usernameController,
);

userRouter.patch(
  "/lock",
  isAuthMiddleware("/api/v2/user/lock", "PATCH"),
  updateUserSettingLock,
);

export default userRouter;
