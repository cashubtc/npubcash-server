import { Request } from "express";
import winston from "winston";
import { getLogLevelFromEnv } from "../config/env";

export const logger = winston.createLogger({
  level: getLogLevelFromEnv(),
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

export function getRequestLogger(req: Request) {
  return logger.child({ reqId: req.reqId });
}
