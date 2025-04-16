#!/usr/bin/env node

import esbuild from "esbuild";
import { resolve } from "path";

const rootDir = process.env.ROOT_DIR || process.cwd();

esbuild
  .build({
    outdir: resolve(rootDir, "./dist/server/"),
    outExtension: { ".js": ".cjs" },
    format: "cjs",
    platform: "node",
    entryPoints: ["src/index.ts"],
    bundle: true,
    sourcemap: "external",
  })
  .then(() => {
    console.log("Server built sucessfully");
  });
