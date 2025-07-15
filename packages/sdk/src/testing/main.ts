import { NPCClient } from "../client";
import { ConsoleLogger } from "../logger";
import { JWTAuthProvider } from "../provider";

const baseUrl = "https://npubx.cash";
const logger = new ConsoleLogger();

const client = new NPCClient(
  "https://npubx.cash",
  new JWTAuthProvider(
    baseUrl,
    async (t) => {
      const signed = await window.nostr!.signEvent(t);
      return signed;
    },
    logger,
  ),
);
client.setLogger(logger);

const testButton = document.createElement("button");
testButton.innerText = "Testing";
testButton.addEventListener("click", async () => {
  const test = await client.getAllQuotes();
});

const testButton2 = document.createElement("button");
testButton2.innerText = "Testing";
testButton2.addEventListener("click", async () => {
  const test = await client.getQuotesSince(
    Math.floor((Date.now() - 60 * 60 * 24 * 14 * 1000) / 1000),
  );
});

document.body.appendChild(testButton);
document.body.appendChild(testButton2);
