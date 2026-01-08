import { NPCClient } from "../client";
import { ConsoleLogger } from "../logger";
import { JWTAuthProvider } from "../provider";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
} from "nostr-tools";
import { PaymentRequiredError } from "../types";

const baseUrl = "https://npubx.cash";
const logger = new ConsoleLogger();

const testSk = generateSecretKey();
const testPk = getPublicKey(testSk);
const testNpub = nip19.npubEncode(testPk);

console.log("Dev Page loaded!");
console.log("Test PK :", testPk);
console.log("Test Npub:", testNpub);

const client = new NPCClient(
  "https://npubx.cash",
  new JWTAuthProvider(baseUrl, async (t) => finalizeEvent(t, testSk), logger),
);
client.setLogger(logger);

function createTestButton(
  label: string,
  onClick: () => void | Promise<void>,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.innerText = label;
  button.addEventListener("click", onClick);
  document.body.appendChild(button);
  return button;
}

createTestButton("Testing Username", async () => {
  try {
    const test = await client.setUsername("testingSdk");
    console.log(test);
  } catch (e) {
    if (e instanceof PaymentRequiredError) {
      console.log(e.paymentRequest);
    }
  }
});

createTestButton("Testing Info", async () => {
  const test = await client.getInfo();
  console.log(test);
});

createTestButton("Testing", async () => {
  const test = await client.getQuotesSince(
    Math.floor((Date.now() - 60 * 60 * 24 * 14 * 1000) / 1000),
  );
});
