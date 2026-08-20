# NpubCash SDK (`npubcash-sdk`) <Badge type="warning" text="npubcash v2" />

TypeScript client for the npubcash v2 API. Ships ESM and CJS builds with type declarations. Works in modern browsers and Node 18+ (WebSocket may need a polyfill in Node). It can be used to request pending mint quotes from npubcash-server.

### Install

```bash
npm install npubcash-sdk
# or
pnpm add npubcash-sdk
# or
yarn add npubcash-sdk
```

### Signer

npubcash-server expects request to be [authenticated](../api/authentication.md). The SDK handles everything for you, but requires access to a nostr signer.

```ts
signer: (e: Omit<NostrEvent, "id" | "sig" | "pubkey">) => NostrEvent;
```

### Quick start

```ts
import { NPCClient, JWTAuthProvider, ConsoleLogger } from "npubcash-sdk";

// Your API base URL (do not include trailing slash)
const baseUrl = "https://example.npub.cash";

// Auth provider: handles NIP-98 → short-lived JWT exchange (cached), requires access to a Signer that can sign nostr events.
const auth = new JWTAuthProvider(baseUrl, signer);

// Create the client and optional logger
const client = new NPCClient(baseUrl, auth);
client.setLogger(new ConsoleLogger());

// Fetch quotes
const allQuotes = await client.getAllQuotes();
const recent = await client.getQuotesSince(
  Math.floor(Date.now() / 1000) - 3600
);

// Subscribe to realtime updates (NIP-98 challenge/response over WS)
const dispose = client.subscribe(
  (quoteId) => {
    console.log("Updated quote:", quoteId);
  },
  (err) => {
    console.error("WS error", err);
  }
);

// Later, to stop receiving updates
dispose();
```

### What’s included

- **`NPCClient`**: main HTTP + WebSocket client
- **`JWTAuthProvider`**: NIP‑98 → short‑lived JWT provider with caching
- **`ConsoleLogger`** and **`type Logger`**: pluggable logging

### Environment notes

- **Browser**: uses `fetch`, `WebSocket`, and optional `window.nostr` signer.
- **Node 18+**: `fetch` is built-in; you may need a `WebSocket` polyfill:

```ts
// Only if your environment lacks global WebSocket
import WebSocket from "ws";
(globalThis as any).WebSocket = WebSocket;
```

### Authentication model

`NPCClient` accepts any `AuthProvider` implementation:

- `getAuthToken(url, method): Promise<string>` — returns an HTTP `Authorization` token (typically `Bearer <jwt>`)
- `getNostrToken(url, method): Promise<string>` — returns a Nostr-form token for NIP‑98 challenges (used for WS)

The provided **`JWTAuthProvider`**:

- Signs `GET {baseUrl}/api/v2/auth/nip98` via NIP‑98 (using your Nostr signer),
- Exchanges it for a short‑lived JWT (cached ~5 minutes),
- Supplies `Bearer` tokens for HTTP and Nostr tokens for WS authentication.

### API overview

#### Client construction

```ts
const auth = new JWTAuthProvider(baseUrl);
const client = new NPCClient(baseUrl, auth);
```

Optionally set a logger:

```ts
import { ConsoleLogger } from "npubcash-sdk";
client.setLogger(new ConsoleLogger());
```

#### Quotes (HTTP)

- `getAllQuotes(): Promise<Quote[]>` — returns all quotes (auto‑paginated).
- `getQuotesSince(sinceSeconds: number): Promise<Quote[]>` — quotes updated since UNIX seconds.

```ts
const quotes = await client.getAllQuotes();
const since = await client.getQuotesSince(Math.floor(Date.now() / 1000) - 600);
```

#### Realtime (WebSocket)

- `subscribe(onUpdate, onError?) => disposer` — connects to `${baseUrl}/api/v2/ws/quote`.
- Server sends a `challenge`; client responds via NIP‑98 using `getNostrToken`.
- `onUpdate(quoteId: string)` is called when a quote changes.

```ts
const stop = client.subscribe(
  (quoteId) => console.log("Quote updated", quoteId),
  (err) => console.error("Realtime error", err)
);

// Call when you want to stop listening
stop();
```

#### Settings (`client.settings`)

- `setMintUrl(mintUrl: string): Promise<UserResponse>` — update the user’s mint URL.
- `setLock(lockQuotes: boolean): Promise<UserResponse>` — lock/unlock quotes.

```ts
await client.settings.setMintUrl("https://mint.example");
await client.settings.setLock(true);
```

### Logging

The `Logger` interface defines `info`, `warn`, `error`, `debug`. By default, a no‑op logger is used. Provide your own or use `ConsoleLogger`.

```ts
client.setLogger(new ConsoleLogger());
```

### TypeScript notes

- Return types are inferred from the SDK; you do not need to install extra type packages.
- If you want explicit types (e.g., `Quote`), you may import them from the transitive `npubcash-types` package, but it’s optional.

```ts
// Optional
import type { Quote } from "npubcash-types";
```

### Module formats

- ESM: `dist/npc-sdk.mjs`
- CJS: `dist/npc-sdk.cjs`
- Type declarations: `dist/types`

External dependency for bundlers: `nostr-tools/nip98`.

### Error handling

- HTTP methods reject with an error on non‑OK responses.
- Realtime errors are forwarded to the optional `onError` callback and the logger.

### Troubleshooting

- Ensure a Nostr signer is available for NIP‑98 (e.g., `window.nostr` in browsers).
- In Node, add a global `WebSocket` (see polyfill example above) if your runtime lacks it.
