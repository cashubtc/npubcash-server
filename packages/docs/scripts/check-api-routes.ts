import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const docsRoot = resolve(import.meta.dir, "..");
const repoRoot = resolve(docsRoot, "../..");
const routesRoot = join(repoRoot, "packages/server/src/routes");
const methods = new Set(["get", "post", "put", "patch", "delete"]);

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function normalizePath(path: string): string {
  return path.replace(/:([^/]+)/g, "{$1}");
}

function joinPath(...parts: string[]): string {
  return normalizePath(`/${parts.join("/")}`.replace(/\/{2,}/g, "/"));
}

function routeCalls(source: string): Array<{ method: string; path: string }> {
  return [...source.matchAll(/\b\w+Router\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)].map(
    ([, method, path]) => ({ method, path }),
  );
}

const actual = new Set<string>();
const baseSource = read(join(routesRoot, "index.ts"));
for (const route of routeCalls(baseSource)) {
  actual.add(`${route.method.toUpperCase()} ${normalizePath(route.path)}`);
}

const v2Source = read(join(routesRoot, "v2/index.ts"));
for (const route of routeCalls(v2Source)) {
  actual.add(
    `${route.method.toUpperCase()} ${joinPath("api/v2", route.path)}`,
  );
}

const imports = new Map(
  [...v2Source.matchAll(/import\s+(\w+)\s+from\s+"\.\/([^"]+)"/g)].map(
    ([, name, path]) => [name, path],
  ),
);

for (const [, prefix, routerName] of v2Source.matchAll(
  /v2Router\.use\(\s*"([^"]+)",\s*(\w+)\s*\)/g,
)) {
  const routeFile = imports.get(routerName);
  if (!routeFile) {
    throw new Error(`Could not resolve ${routerName} from routes/v2/index.ts`);
  }
  const source = read(join(routesRoot, "v2", `${routeFile}.ts`));
  for (const route of routeCalls(source)) {
    actual.add(
      `${route.method.toUpperCase()} ${joinPath("api/v2", prefix, route.path)}`,
    );
  }
}

const specification = parse(read(join(docsRoot, "public/openapi.yaml"))) as {
  paths: Record<string, Record<string, unknown>>;
};
const documented = new Set<string>();
for (const [path, operations] of Object.entries(specification.paths)) {
  for (const method of Object.keys(operations)) {
    if (methods.has(method)) documented.add(`${method.toUpperCase()} ${path}`);
  }
}

const missing = [...actual].filter((route) => !documented.has(route)).sort();
const extra = [...documented].filter((route) => !actual.has(route)).sort();

if (missing.length || extra.length) {
  if (missing.length) {
    console.error(`Missing from OpenAPI:\n${missing.join("\n")}`);
  }
  if (extra.length) {
    console.error(`Not implemented by the server:\n${extra.join("\n")}`);
  }
  process.exit(1);
}

console.log(`OpenAPI matches all ${actual.size} implemented HTTP routes.`);
