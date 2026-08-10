import app from "./app";
import { getAdapter, setupDatabase } from "./utils/database";
import ws from "ws";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { logger } from "./utils/logger";
import { config } from "./config/index";
import { createServer } from "http";
import { websocketUpgradeController } from "./websocket/controller";
import {
  startMintQuoteMonitoring,
  stopMintQuoteMonitoring,
} from "./config";
useWebSocketImplementation(ws);
logger.info("+++ Loaded App Config +++");
logger.info(`Log Level: ${config.logLevel}`);
logger.info(`Nostr enabled: ${config.nostr.nostrEnabled}`);
logger.info(
  `LNURL Limits: Min: ${config.lnurlLimits.min} - Max: ${config.lnurlLimits.max}`,
);
logger.info(`Username enabled: ${config.usernameConfig.enabled}`);
config.usernameConfig.enabled &&
  logger.info(
    `Username config - mint: ${config.usernameConfig.mintUrl}, amount: ${config.usernameConfig.amount}`,
  );

async function startServer() {
  logger.debug("Starting npubcash-server...");
  try {
    await setupDatabase();
  } catch (e) {
    logger.error("Database migrations failed! Exiting...");
    console.error(e);
    process.exit(1);
  }
  await startMintQuoteMonitoring();
  const server = createServer(app);
  server.on("upgrade", websocketUpgradeController);
  server.listen(config.port, () => {
    logger.info(`npubcash-server has started and is listening on port ${config.port}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}; shutting down`);
    const serverClosed = new Promise<void>((resolve, reject) => {
      server.close((cause) => {
        if (cause) reject(cause);
        else resolve();
      });
    });
    try {
      await stopMintQuoteMonitoring();
      await serverClosed;
      await getAdapter().close();
      process.exit(0);
    } catch (cause) {
      logger.error("Graceful shutdown failed", { cause });
      process.exit(1);
    }
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

startServer();
