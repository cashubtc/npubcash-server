import app from "./app";
import { setupDatabase, setupStore } from "./utils/database";
import ws from "ws";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { logger } from "./utils/logger";
import { communicatorService } from "./config";

useWebSocketImplementation(ws);
setupStore();

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
  // try {
  //   await setupCallbacks();
  // } catch (e) {
  //   console.warn("Failed to setup callbacks...");
  //   console.log(e);
  //   process.exit(1);
  // }
  app.listen(process.env.PORT || 8000, () => {
    logger.info(
      "npubcash-server has started and is listening on port " +
        process.env.PORT || 8000,
    );
  });
}

startServer();
