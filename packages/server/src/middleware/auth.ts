import { NextFunction, Request, Response } from "express";
import { verifyAuth } from "../utils/auth";
import { UnauthorizedError } from "@/errors";
import { config } from "@/config/index";
import { getPublicRequestUrl } from "@/utils/publicRequest";

export function isAuthMiddleware(path: string, method: string) {
  async function isAuth(req: Request, res: Response, next: NextFunction) {
    const userAgent = req.get("user-agent");
    if (!userAgent) {
      res.status(400);
      return next(new UnauthorizedError("Missing headers!"));
    }
    let url: string;
    try {
      const publicOrigin = getPublicRequestUrl(
        req,
        config.allowedHostnames,
      ).origin;
      url = `${publicOrigin}${path}`;
    } catch (error) {
      return next(error);
    }
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      res.status(401);
      return next(new UnauthorizedError("Missing authorization header!"));
    }
    const isAuth = await verifyAuth(authHeader, url, method, userAgent);
    if (!isAuth.authorized) {
      res.status(401);
      return next(new UnauthorizedError("Invalid authorization header!"));
    } else {
      req.authData = isAuth;
    }
    next();
  }
  return isAuth;
}
