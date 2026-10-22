export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

/** Temporary CVE-2026-111497 mitigation until the deployed Bun is patched. */
export function createMintFetch(fetchImpl: FetchLike = fetch): FetchLike {
  return async (input, init) => {
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set("Accept-Encoding", "identity");

    // The header alone is insufficient: a hostile mint can ignore it. Bun must
    // never enter its native decoder, including while following redirects.
    const requestInit: RequestInit & { decompress: false } = {
      ...init,
      headers,
      decompress: false,
    };
    const response = await fetchImpl(input, requestInit);
    const encoding = response.headers.get("Content-Encoding");
    if (encoding !== null && encoding.trim().toLowerCase() !== "identity") {
      await response.body?.cancel().catch(() => undefined);
      throw new Error("Compressed mint responses are temporarily disabled");
    }
    return response;
  };
}
