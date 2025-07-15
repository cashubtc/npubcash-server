import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "./dist",
    lib: {
      entry: "./src/client.ts",
      name: "npubcash-sdk",
      fileName: "npc-sdk",
    },
  },
});
