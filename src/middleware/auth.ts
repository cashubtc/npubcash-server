import { NextFunction, Request, Response } from "express";
import { verifyAuth } from "../utils/auth";

export function isAuthMiddleware(url: string, method: string) {
  async function isAuth(req: Request, res: Response, next: NextFunction) {
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
