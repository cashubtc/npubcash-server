import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const docsRoot = resolve(import.meta.dir, "..");
const contentRoot = join(docsRoot, "docs");
const errors: string[] = [];

function walkMarkdown(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? walkMarkdown(path)
      : path.endsWith(".md")
        ? [path]
        : [];
  });
}

const markdownFiles = [join(docsRoot, "index.md"), ...walkMarkdown(contentRoot)];

function resolveTarget(source: string, href: string): string | undefined {
  const decoded = decodeURIComponent(href);
  if (decoded.startsWith("/")) {
    const publicTarget = join(docsRoot, "public", decoded.slice(1));
    if (existsSync(publicTarget)) return publicTarget;
    if (decoded === "/") return join(docsRoot, "index.md");
    return join(docsRoot, `${decoded.slice(1)}.md`);
  }

  let target = resolve(dirname(source), decoded || ".");
  if (existsSync(target) && statSync(target).isDirectory()) {
    target = join(target, "index.md");
  } else if (!existsSync(target) && extname(target) === "") {
    target += ".md";
  }
  return target;
}

function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function anchors(path: string): Set<string> {
  const result = new Set<string>();
  const seen = new Map<string, number>();
  const content = readFileSync(path, "utf8");
  for (const match of content.matchAll(/^#{1,6}\s+(.+?)(?:\s+#+)?$/gm)) {
    const base = slugify(match[1]);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    result.add(count === 0 ? base : `${base}-${count}`);
  }
  return result;
}

function checkLink(source: string, rawHref: string) {
  if (/^(?:[a-z]+:|\/\/)/i.test(rawHref)) return;
  const [href, fragment] = rawHref.split("#", 2);
  const target = resolveTarget(source, href);
  const label = `${relative(docsRoot, source)} -> ${rawHref}`;

  if (!target || !existsSync(target)) {
    errors.push(`${label}: target does not exist`);
    return;
  }
  if (fragment && target.endsWith(".md") && !anchors(target).has(fragment)) {
    errors.push(`${label}: heading does not exist`);
  }
}

for (const file of markdownFiles) {
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(/!?\[[^\]]*]\(([^)\s]+)(?:\s+[^)]*)?\)/g)) {
    checkLink(file, match[1].replace(/^<|>$/g, ""));
  }
  for (const match of content.matchAll(/^\s*<<<\s+([^\s{#[\]]+)/gm)) {
    const include = resolve(dirname(file), match[1]);
    if (!existsSync(include)) {
      errors.push(`${relative(docsRoot, file)} -> ${match[1]}: include does not exist`);
    }
  }
}

const configPath = join(docsRoot, ".vitepress", "config.ts");
const config = readFileSync(configPath, "utf8");
for (const match of config.matchAll(/link:\s*"([^"]+)"/g)) {
  checkLink(configPath, match[1]);
}

if (errors.length > 0) {
  console.error(errors.sort().join("\n"));
  process.exit(1);
}

console.log(`Checked ${markdownFiles.length} Markdown files for local links.`);
