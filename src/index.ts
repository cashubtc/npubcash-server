import { useWebSocketImplementation } from "nostr-tools";
import app from "./app";
import { setupDatabase } from "./utils/database";

useWebSocketImplementation(require("ws"));

async function startServer() {
  try {
    await setupDatabase();
  } catch (e) {
    console.warn("Database Migrations failed!!");
    console.log(e);
  }
  console.log("starting server...");
  app.listen(process.env.PORT || 8000);
}

startServer();
