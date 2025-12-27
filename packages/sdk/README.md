## npubcash-sdk

TypeScript client SDK for the NpubCash v2 API. Provides a high-level HTTP client, NIP-98/JWT authentication, realtime quote updates over WebSocket, and simple settings helpers.

### Features

- **NPCClient**: Fetch quotes, subscribe to updates, update user settings
- **JWTAuthProvider**: NIP-98 → short-lived JWT with transparent caching
- **Logging**: `ConsoleLogger` or bring your own `Logger` implementation
- **ESM/CJS**: Works with modern bundlers and Node

### Installation

```bash
npm install npubcash-sdk
# or
bun add npubcash-sdk
```

### Quick start

```ts
import { NPCClient, JWTAuthProvider, ConsoleLogger } from "npubcash-sdk";

const baseUrl = "https://npubx.cash"; // Your NpubCash server

// Browser example: Nostr signer from a browser extension (NIP-07)
const signer = async (template: any) => window.nostr!.signEvent(template);

const client = new NPCClient(baseUrl, new JWTAuthProvider(baseUrl, signer));
client.setLogger(new ConsoleLogger());

// Fetch all quotes (auto-paginates)
const quotes = await client.getAllQuotes(); // type inferred

// Subscribe to realtime updates
const dispose = client.subscribe(
  (quoteId) => {
    console.log("Quote updated:", quoteId);
  },
  (message) => {
    console.error("Subscription error:", message);
  }
);

// Update user settings
await client.settings.setMintUrl("https://example-mint.tld");
await client.settings.setLock(true);

// Later: stop listening
dispose();
```

### Node usage

The SDK expects `fetch` and `WebSocket` to be available. On Node 18+, `fetch` is built-in; you may need to polyfill `WebSocket`:

```ts
import WebSocket from "ws";
(globalThis as any).WebSocket = WebSocket;

import { NPCClient, JWTAuthProvider } from "npubcash-sdk";

const baseUrl = "https://npubx.cash";

// Provide a Nostr signer compatible with NIP-98 (implementation-specific)
const signer = async (template: any) => {
  // Use your key management to produce a SignedEvent
  // Return an object with kind, tags, content, created_at, pubkey, id, sig
  throw new Error("Implement Nostr signing for your environment");
};

const client = new NPCClient(baseUrl, new JWTAuthProvider(baseUrl, signer));
```

### API overview

#### Exports

- `NPCClient`
- `JWTAuthProvider`
- `ConsoleLogger`, `type Logger`

Return types are fully inferred from method signatures; explicit type imports are optional.

#### NPCClient

- `constructor(baseUrl: string, authProvider: AuthProvider)`
- `setLogger(logger: Logger): void`
- `getQuotesSince(since: number): Promise<Quote[]>` — UNIX seconds
- `getAllQuotes(): Promise<Quote[]>`
- `subscribe(onUpdate: (quoteId: string) => void, onError?: (msg: string) => void): () => void` — disposer
- `settings: SettingsManager`
  - `setMintUrl(mintUrl: string): Promise<UserResponse>`
  - `setLock(lockQuotes: boolean): Promise<UserResponse>`

#### AuthProvider

Interface consumed by `NPCClient`:

- `getAuthToken(url: string, method: string): Promise<string>` — e.g., `Bearer <jwt>` or Nostr token form
- `getNostrToken(url: string, method: string): Promise<string>` — for WS challenge/response (NIP-98)

#### JWTAuthProvider

Default implementation that:

1. Signs a NIP-98 challenge against `GET {baseUrl}/api/v2/auth/nip98`
2. Exchanges for a short-lived JWT (cached ~5 minutes)
3. Supplies tokens for HTTP and WS flows

### WebSocket subscription

`NPCClient.subscribe()` opens a socket to `${baseUrl}/api/v2/ws/quote` and authenticates via NIP-98 challenge/response. You receive the `quoteId` for each update:

```ts
const dispose = client.subscribe((quoteId) => {
  console.log("Quote updated:", quoteId);
});

// ... later
dispose();
```

### Error handling

- HTTP methods throw `ApiError` on non-2xx responses.
- WebSocket issues are reported via the optional `onError` callback in `subscribe`.

### TypeScript

The SDK is written in TypeScript and ships type declarations. Return types are inferred from method signatures, so you generally do not need to import any types. If you want explicit type names (e.g., `Quote`), you may import them from the transitive dependency `npubcash-types`—no separate install required.

### Module formats

- ESM: `import { NPCClient } from "npubcash-sdk"`
- CJS: `const { NPCClient } = require("npubcash-sdk")`

### License

MIT
