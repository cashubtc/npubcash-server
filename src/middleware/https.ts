import { NextFunction, Request, Response } from "express";

export function requireHTTPS(req: Request, res: Response, next: NextFunction) {
  if (
    !req.secure &&
    req.get("x-forwarded-proto") !== "https" &&
    process.env.NODE_ENV !== "development" &&
    process.env.NODE_ENV !== "test"
  ) {
    return res.redirect("https://" + req.get("host") + req.url);
  }
  next();
}
