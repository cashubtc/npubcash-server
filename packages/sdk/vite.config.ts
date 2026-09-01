import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      bundledPackages: ["@npubcash/api-contract"],
      rollupTypes: true,
    }),
  ],
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
