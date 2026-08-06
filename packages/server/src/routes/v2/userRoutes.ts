import { usernameController } from "@/controller/username";
import {
  getUserSettings,
  updateUserMintSetting,
  updateUserSettingLock,
} from "@/controller/userSettingsController";
import { isAuthMiddleware } from "@/middleware/auth";
import { Router } from "express";

const userRouter = Router();

userRouter.get(
  "/info",
  isAuthMiddleware(),
  getUserSettings,
);

userRouter.post(
  "/username",
  isAuthMiddleware(),
  usernameController,
);

userRouter.patch(
  "/lock",
  isAuthMiddleware(),
  updateUserSettingLock,
);

userRouter.patch(
  "/mint",
  isAuthMiddleware(),
  updateUserMintSetting,
);

export default userRouter;
