import { initializeCoco } from "coco-cashu-core";
import { IndexedDbRepositories } from "coco-cashu-indexeddb";

const SEED_STORAGE_KEY = "coco-seed";

async function getSeed(): Promise<Uint8Array> {
  const stored = localStorage.getItem(SEED_STORAGE_KEY);
  if (stored) {
    return new Uint8Array(JSON.parse(stored));
  }
  const seed = crypto.getRandomValues(new Uint8Array(64));
  localStorage.setItem(SEED_STORAGE_KEY, JSON.stringify([...seed]));
  return seed;
}

const repo = new IndexedDbRepositories({ name: "coco-npc" });

export const coco = await initializeCoco({ repo, seedGetter: getSeed });
