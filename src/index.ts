import { useWebSocketImplementation } from "nostr-tools";
import app from "./app";
import { setupDatabase, setupStore } from "./utils/database";
import { setupCallbacks } from "./utils/blink";

useWebSocketImplementation(require("ws"));
setupStore();

async function startServer() {
  try {
    await setupDatabase();
  } catch (e) {
    console.warn("Database Migrations failed!!");
    console.log(e);
    process.exit(1);
  }
  try {
    await setupCallbacks();
  } catch (e) {
    console.warn("Failed to setup callbacks...");
    console.log(e);
    process.exit(1);
  }
  console.log("starting server...");
  app.listen(process.env.PORT || 8000);
}

startServer();
