#!/usr/bin/env node

const esbuild = require("esbuild");
const { resolve } = require("path");

const rootDir = process.env.ROOT_DIR || process.cwd();

esbuild
  .build({
    outdir: resolve(rootDir, "./dist/env/"),
    format: "cjs",
    platform: "node",
    entryPoints: ["src/index.ts"],
    bundle: true,
    sourcemap: "external",
  })
  .then(() => {
    console.log("npubcash-env built successfully!");
  });
