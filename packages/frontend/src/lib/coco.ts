import { ConsoleLogger, initializeCoco, type Manager } from "coco-cashu-core";
import { IndexedDbRepositories } from "coco-cashu-indexeddb";
import { NPCPlugin } from "coco-cashu-plugin-npc";
import type { Event, EventTemplate } from "nostr-tools";

export type { Manager };

const SEED_STORAGE_KEY_PREFIX = "coco-seed_";

class LocalStorageSinceStore {
  private readonly TS_STORAGE_KEY = "NPC_SINCE";
  async get() {
    const storedSince = localStorage.getItem(this.TS_STORAGE_KEY);
    return storedSince
      ? Number(storedSince)
      : Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  }

  async set(ts: number) {
    localStorage.setItem(this.TS_STORAGE_KEY, ts.toString());
  }
}

function getSeedFactory(pubkey: string): () => Promise<Uint8Array> {
  return async function () {
    const stored = localStorage.getItem(SEED_STORAGE_KEY_PREFIX + pubkey);
    if (stored) {
      return new Uint8Array(JSON.parse(stored));
    }
    const seed = crypto.getRandomValues(new Uint8Array(64));
    localStorage.setItem(
      SEED_STORAGE_KEY_PREFIX + pubkey,
      JSON.stringify([...seed]),
    );
    return seed;
  };
}

export async function initializeWallet(
  pubkey: string,
  signer: (t: EventTemplate) => Promise<Event>,
): Promise<Manager> {
  const repo = new IndexedDbRepositories({ name: `coco-${pubkey}` });
  const logger = new ConsoleLogger("coco", { level: "debug" });
  const npcPlugin = new NPCPlugin("https://npubx.cash", signer, {
    useWebsocket: true,
    syncIntervalMs: 90000,
    logger,
    sinceStore: new LocalStorageSinceStore(),
  });
  const seedGetter = getSeedFactory(pubkey);
  const coco = await initializeCoco({
    repo,
    seedGetter,
    plugins: [npcPlugin],
    logger,
  });
  await npcPlugin.sync();
  return coco;
}
