import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";

const rootDir = process.env.ROOT_DIR || process.cwd();

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: resolve(rootDir, "./dist/website"),
  },
  plugins: [react()],
  envPrefix: "NPC_",
});
