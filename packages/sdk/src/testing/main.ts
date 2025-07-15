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

document.body.appendChild(testButton);
