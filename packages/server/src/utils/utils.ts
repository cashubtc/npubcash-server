export function normalizeUrl(input: string): string {
  const url = new URL(input.trim());

  const protocol = url.protocol.toLowerCase();
  const hostname = url.hostname.toLowerCase();

  const port = url.port;

  let pathname = url.pathname.replace(/\/\/{2,}/g, "/").replace(/\/$/, "");

  return `${protocol}//${hostname}${port ? ":" + port : ""}${pathname}`;
}
