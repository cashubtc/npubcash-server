import { Request, Response, NextFunction } from "express";
import { ApiError } from ".";

export function errorHandler(
  err: any,
  _: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(err);
  }
  console.error("Error:", err);
  if (err instanceof ApiError) {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    return res.status(statusCode).json({ error: true, message });
  }
  res.status(500).json({ error: true, message: "Internal Server Error" });
}
