import { NPCClient, type AuthProvider } from "../client";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip98,
} from "nostr-tools";
import { npubEncode } from "nostr-tools/nip19";
import { ConsoleLogger } from "../logger";

const now = new Date();

class TestingAuthProvider implements AuthProvider {
  private sk: Uint8Array = generateSecretKey();

  constructor() {
    console.log(`pubkey: ${getPublicKey(this.sk)}`);
    console.log(`npub: ${npubEncode(getPublicKey(this.sk))}`);
  }

  async getAuthToken(url: string, method: string): Promise<string> {
    console.log(url);
    const token = await nip98.getToken(url, method, async (t) =>
      finalizeEvent(t, this.sk),
    );
    return `Nostr ${token}`;
  }
}

const client = new NPCClient("https://npubx.cash", new TestingAuthProvider());
client.setLogger(new ConsoleLogger());

await client.settings.setMintUrl("https://nofees.testnut.cashu.space");

const testButton = document.createElement("button");
testButton.innerText = "Testing";
testButton.addEventListener("click", async () => {
  const test = await client.getQuotesSince(Math.floor(now.getTime() / 1000));
  console.log(test);
});

document.body.appendChild(testButton);
