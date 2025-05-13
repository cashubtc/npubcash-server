import { usernameController } from "@/controller/username";
import {
  updateUserMintSetting,
  updateUserSettingLock,
} from "@/controller/userSettingsController";
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

userRouter.patch(
  "/mint",
  isAuthMiddleware("/api/v2/user/mint", "PATCH"),
  updateUserMintSetting,
);

export default userRouter;
