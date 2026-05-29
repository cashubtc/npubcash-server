import { useWebSocketImplementation } from "nostr-tools";
import { injectWebSocketImpl } from "@cashu/cashu-ts";
import app from "./app";
import { setupDatabase, setupStore } from "./utils/database";
import { Analyzer } from "./utils/analytics";
import { wallet } from "./config";
import { PaymentSettlementService } from "./services/paymentSettlement";

const WebSocket = require("ws");
useWebSocketImplementation(WebSocket);
injectWebSocketImpl(WebSocket);
setupStore();
setInterval(
  () => {
    Analyzer.getInstance().logAnalytics();
  },
  60 * 1 * 1000,
);

async function startServer() {
  try {
    await setupDatabase();
  } catch (e) {
    console.warn("Database Migrations failed!!");
    console.log(e);
    process.exit(1);
  }
  try {
    await wallet.loadMint();
    await PaymentSettlementService.getInstance().recoverUnfulfilledTransactions();
  } catch (e) {
    console.warn("Failed to setup Cashu wallet...");
    console.log(e);
    process.exit(1);
  }
  console.log("starting server...");
  app.listen(process.env.PORT || 8000);
}

startServer();
