import { NextFunction, Request, Response } from "express";
import { verifyAuth } from "../utils/auth";

export function isAuthMiddleware(path: string, method: string) {
  async function isAuth(req: Request, res: Response, next: NextFunction) {
    const hostname = req.header("host");
    const protocol = req.protocol;
    if (!hostname) {
      res.status(400);
      return next(new Error("Missing host header"));
    }
    const url = protocol + "://" + hostname + path;
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      res.status(401);
      return next(new Error("Missing Authorization Header"));
    }
    const isAuth = await verifyAuth(authHeader, url, method);
    if (!isAuth.authorized) {
      res.status(401);
      return next(new Error("Invalid Authorization Header"));
    } else {
      req.authData = isAuth;
    }
    next();
  }
  return isAuth;
}
