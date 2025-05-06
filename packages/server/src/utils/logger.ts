import { Request } from "express";
import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL === "DEBUG" ? "debug" : "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

export function getRequestLogger(req: Request) {
  return logger.child({ reqId: req.reqId });
}
