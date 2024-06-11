import { defineConfig } from "vite";
import { configDefaults, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "npubcash-website"],
    coverage: {
      exclude: [
        ...coverageConfigDefaults.exclude,
        "npubcash-website",
        "build.js",
        "migrations",
      ],
    },
  },
});
