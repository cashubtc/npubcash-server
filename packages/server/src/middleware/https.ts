import { NextFunction, Request, Response } from "express";
import { config } from "@/config/index";
import { getPublicRequestUrl } from "@/utils/publicRequest";

export function requireHTTPS(req: Request, res: Response, next: NextFunction) {
  try {
    const publicUrl = getPublicRequestUrl(req, config.allowedHostnames);
    if (publicUrl.protocol !== "https:" && config.nodeEnv !== "development") {
      publicUrl.protocol = "https:";
      return res.redirect(publicUrl.toString());
    }
    next();
  } catch (error) {
    next(error);
  }
}
