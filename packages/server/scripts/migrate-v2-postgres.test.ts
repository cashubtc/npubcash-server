import { describe, expect, test } from "bun:test";
import { parseArgs } from "./migrate-v2-postgres";

const source = "postgres://user:secret@source.example/v2";
const target = "postgres://user:secret@target.example/v3";

describe("migrate-v2-postgres CLI", () => {
  test("accepts a dry run without the stopped-writers confirmation", () => {
    const options = parseArgs(
      ["--source", source, "--target", target, "--dry-run"],
      {},
    );

    expect(options.dryRun).toBe(true);
    expect(options.confirmV2Stopped).toBe(false);
    expect(options.batchSize).toBe(500);
  });

  test("requires confirmation before modifying the target", () => {
    expect(() => parseArgs(["--source", source, "--target", target], {})).toThrow(
      "--confirm-v2-stopped",
    );
  });

  test("reads URLs from environment variables", () => {
    const options = parseArgs(["--dry-run"], {
      V2_DATABASE_URL: source,
      V3_DATABASE_URL: target,
    });

    expect(options.sourceUrl).toBe(source);
    expect(options.targetUrl).toBe(target);
  });

  test("rejects the same source and target database", () => {
    expect(() =>
      parseArgs(
        [
          "--source",
          source,
          "--target",
          "postgres://other:credentials@source.example/v2",
          "--dry-run",
        ],
        {},
      ),
    ).toThrow("Source and target must be different");
  });

  test("rejects invalid batch sizes and non-PostgreSQL URLs", () => {
    expect(() =>
      parseArgs(
        [
          "--source",
          source,
          "--target",
          target,
          "--batch-size",
          "0",
          "--dry-run",
        ],
        {},
      ),
    ).toThrow("--batch-size");
    expect(() =>
      parseArgs(
        ["--source", "./v2.db", "--target", target, "--dry-run"],
        {},
      ),
    ).toThrow("source URL is invalid");
  });
});
