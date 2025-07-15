import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "./dist",
    lib: {
      entry: "./src/index.ts",
      name: "npubcash-sdk",
      fileName: "npc-sdk",
    },
    rollupOptions: {
      external: ["nostr-tools/nip98"],
    },
  },
});
