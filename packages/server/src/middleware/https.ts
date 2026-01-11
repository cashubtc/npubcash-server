import { NextFunction, Request, Response } from "express";
import { config } from "@/config/index";

export function requireHTTPS(req: Request, res: Response, next: NextFunction) {
  if (
    !req.secure &&
    req.get("x-forwarded-proto") !== "https" &&
    config.nodeEnv !== "development"
  ) {
    return res.redirect("https://" + req.get("host") + req.url);
  }
  next();
}
