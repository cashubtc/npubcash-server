import express, { Response } from "express";
import bodyparser from "body-parser";
import cors from "cors";
import compression from "compression";
import { requireHTTPS } from "./middleware/https";
import path from "path";
import baseRouter from "./routes";
import { errorHandler } from "./errors/middleware";
import { randomUUID } from "crypto";
import { AppConfig } from "./config/index";
import { logger } from "./utils/logger";

const app = express();
const config = AppConfig.getInstance();

app.use(bodyparser.json());
(app as any).use(compression());

app.use(cors());
app.use(requireHTTPS);

app.use((req, _, next) => {
  req.reqId = randomUUID();
  logger.info({ message: "Incoming request", reqId: req.reqId, path: req.url });
  next();
});
app.use(baseRouter);
if (config.apiMode === "BOTH") {
  app.use("/", express.static(path.join(__dirname, "../website")));
  app.get("*", (_, res: Response) => {
    res.sendFile(path.join(__dirname, "../website/index.html"));
  });
}
app.use(errorHandler);

export default app;
