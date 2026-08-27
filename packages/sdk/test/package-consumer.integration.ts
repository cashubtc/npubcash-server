import { expect, test } from "bun:test";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const sdkDirectory = resolve(import.meta.dir, "..");
function run(command: string[], cwd: string) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      BUN_INSTALL: join(tmpdir(), "npubcash-sdk-bun"),
      BUN_TMPDIR: tmpdir(),
    },
  });
  expect(
    result.status,
    [result.error?.message, result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n"),
  ).toBe(0);
}

test("packed SDK exposes self-contained public types", () => {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "npubcash-sdk-consumer-"));
  const tarballName = "npubcash-sdk.tgz";

  try {
    run(["bun", "run", "build"], sdkDirectory);
    run(
      [
        "bun",
        "pm",
        "pack",
        "--filename",
        join(fixtureDirectory, tarballName),
        "--ignore-scripts",
        "--quiet",
      ],
      sdkDirectory,
    );

    writeFileSync(
      join(fixtureDirectory, "package.json"),
      JSON.stringify({
        private: true,
        dependencies: { "npubcash-sdk": `file:./${tarballName}` },
      }),
    );
    writeFileSync(
      join(fixtureDirectory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          lib: ["ES2022", "DOM"],
          module: "ESNext",
          moduleResolution: "Bundler",
          noEmit: true,
          strict: true,
          target: "ES2022",
        },
        include: ["consumer.ts"],
      }),
    );
    writeFileSync(
      join(fixtureDirectory, "consumer.ts"),
      `import {
  NPCClient,
  type ProviderInfo,
  type Quote,
  type User,
} from "npubcash-sdk";

declare const client: NPCClient;

const provider: Promise<ProviderInfo> = client.getProviderInfo();
const recipient: Promise<User> = client.getInfo();
const renamed: Promise<User> = client.setUsername("alice");
const mintUpdated: Promise<User> = client.settings.setMintUrl("https://mint.example");
const lockUpdated: Promise<User> = client.settings.setLock(true);
const quotes: Promise<Quote[]> = client.getAllQuotes();

void [provider, recipient, renamed, mintUpdated, lockUpdated, quotes];
`,
    );

    run(
      ["bun", "install", "--ignore-scripts", "--production"],
      fixtureDirectory,
    );
    run(
      [resolve(sdkDirectory, "node_modules/.bin/tsc"), "--noEmit"],
      fixtureDirectory,
    );

    const declaration = readFileSync(
      join(fixtureDirectory, "node_modules/npubcash-sdk/dist/index.d.ts"),
      "utf8",
    );
    expect(declaration).not.toContain('from "npubcash-types"');
    expect(declaration).not.toContain("from 'npubcash-types'");
    expect(declaration).not.toContain("@npubcash/api-contract");
  } finally {
    rmSync(fixtureDirectory, { force: true, recursive: true });
  }
}, 60_000);
