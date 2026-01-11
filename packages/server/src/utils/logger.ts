import { Request } from "express";
import winston from "winston";
import { config } from "../config/index";

export const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

export function getRequestLogger(req: Request) {
  return logger.child({ reqId: req.reqId });
}
