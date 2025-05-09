import { Request } from "express";
import winston from "winston";
import { AppConfig } from "../config/index";

export const logger = winston.createLogger({
  level: AppConfig.getInstance().logLevel,
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

export function getRequestLogger(req: Request) {
  return logger.child({ reqId: req.reqId });
}

logger.info(`Log Level: ${process.env.LOG_LEVEL || "info"}`);
