import { Request } from "express";
import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.NODE_ENV !== "production" ? "debug" : "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

export function getRequestLogger(req: Request) {
  return logger.child({ reqId: req.reqId });
}
