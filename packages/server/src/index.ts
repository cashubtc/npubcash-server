import app from "./app";
import { setupDatabase } from "./utils/database";
import ws from "ws";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { logger } from "./utils/logger";
import { AppConfig } from "./config/index";
import { createServer } from "http";
import { websocketUpgradeController } from "./websocket/controller";
import { communicatorService } from "./config";

const config = AppConfig.getInstance();
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
  await communicatorService.setupPoller();
  const server = createServer(app);
  server.on("upgrade", websocketUpgradeController);
  server.listen(process.env.PORT || 8000, () => {
    logger.info(
      "npubcash-server has started and is listening on port " +
        process.env.PORT || 8000,
    );
  });
}

startServer();
