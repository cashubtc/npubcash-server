import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "./dist",
    lib: {
      entry: "./src/index.ts",
      formats: ["es", "cjs"],
      fileName: (format) => `npc-sdk.${format === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      external: ["nostr-tools/nip98"],
      output: {
        globals: {
          "nostr-tools/nip98": "nostrToolsNip98",
        },
      },
    },
  },
});
