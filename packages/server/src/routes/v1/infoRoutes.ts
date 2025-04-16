import { Router } from "express";
import {
  getInfoController,
  putMintInfoController,
  putUsernameInfoController,
} from "@/controller/infoController";
import { isAuthMiddleware } from "@/middleware/auth";

const infoRouter = Router();

infoRouter.get("/", isAuthMiddleware(`/api/v1/info`, "GET"), getInfoController);
infoRouter.put(
  "/mint",
  isAuthMiddleware(`/api/v1/info/mint`, "PUT"),
  putMintInfoController,
);
infoRouter.put(
  "/username",
  isAuthMiddleware(`/api/v1/info/username`, "PUT"),
  putUsernameInfoController,
);

export default infoRouter;
