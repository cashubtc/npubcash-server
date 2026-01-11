import { NextFunction, Request, Response } from "express";
import { verifyAuth } from "../utils/auth";
import { UnauthorizedError } from "@/errors";
import { config } from "@/config/index";

export function isAuthMiddleware(path: string, method: string) {
  async function isAuth(req: Request, res: Response, next: NextFunction) {
    const userAgent = req.get("user-agent");
    const hostname = req.header("host");
    const protocol = config.nodeEnv === "development" ? "http" : "https";
    if (!hostname || !userAgent) {
      res.status(400);
      return next(new UnauthorizedError("Missing headers!"));
    }
    const url = protocol + "://" + hostname + path;
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
