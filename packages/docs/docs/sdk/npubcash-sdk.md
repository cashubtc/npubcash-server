# npubcash SDK (`npubcash-sdk`)

`npubcash-sdk` is a TypeScript client for the npubcash HTTP and WebSocket APIs.
It handles NIP-98 authentication, short-lived JWTs, pagination, settings, paid
username requests, and quote-update subscriptions.

## Install

```bash
npm install npubcash-sdk
```

The package provides ESM, CommonJS, and TypeScript declarations.

## Signer

`JWTAuthProvider` needs a function that signs a Nostr event template and returns
the completed event:

```ts
type SigningFunc = (event: EventTemplate) => Promise<SignedEvent>;
```

Use a browser extension, signer library, or secure key store to implement this
function. The private key should never be passed to npubcash-server.

## Quick start

<<< ../../examples/sdk-quick-start.ts

Do not include a trailing slash in `baseUrl`.

## Client API

### Account

- `getInfo(): Promise<User>` returns the current mint, quote-locking preference,
  and optional username.
- `setUsername(username, token?)` implements the Cashu payment flow for a paid
  username. The feature may be disabled by the server operator.

Call `setUsername` without a token first. When the server requires payment, the
SDK throws `PaymentRequiredError` with a decoded Cashu payment request. Pay it
and call `setUsername` again with the resulting Cashu token.

### Paid quotes

- `getAllQuotes(): Promise<Quote[]>` retrieves all available quote history and
  follows pagination automatically.
- `getQuotesSince(timestamp): Promise<Quote[]>` retrieves quotes paid after a
  Unix timestamp in seconds.

The server continues returning a paid quote after a wallet has minted or spent
it. Persist processed `(mintUrl, quoteId)` pairs before treating this API as a
collection queue.

### Settings

Settings are available through `client.settings`:

```ts
await client.settings.setMintUrl("https://mint.example");
await client.settings.setLock(true);
```

Changing the mint affects future payments only. Enabling locking requires a
mint that advertises support for the server's locking flow.

### Realtime updates

`subscribe(onUpdate, onError?)` opens the quote WebSocket and authenticates with
NIP-98. It returns a function that closes the connection.

An update contains a quote ID, not the complete quote. Fetch quote history after
an update to obtain the current state. The subscription does not reconnect
automatically after a transport failure.

## Authentication model

`NPCClient` accepts any object implementing `AuthProvider`:

```ts
interface AuthProvider {
  getAuthToken(url: string, method: string): Promise<string>;
  getNostrToken(url: string, method: string): Promise<string>;
}
```

The included `JWTAuthProvider` signs `GET /api/v2/auth/nip98`, exchanges that
NIP-98 event for a JWT, and caches the token for approximately five minutes.
The server-issued JWT itself is valid for 30 minutes.

## Logging

The SDK uses a no-op logger by default. Pass `ConsoleLogger` or another
implementation of `Logger` to receive `info`, `warn`, `error`, and `debug`
messages.

```ts
client.setLogger(new ConsoleLogger());
```

## Errors

HTTP failures throw `ApiError`. Username payment requests throw
`PaymentRequiredError`. See [Error handling](../api/error-handling.md) for a
type-safe example.

## Runtime and module formats

The SDK expects global `fetch` and `WebSocket` implementations. Modern browsers
and Bun provide both. In Node runtimes without a global WebSocket, install a
compatible polyfill before subscribing.

Package entry points:

- ESM: `dist/npc-sdk.mjs`
- CommonJS: `dist/npc-sdk.cjs`
- Type declarations: `dist/index.d.ts`

The SDK does not currently re-export API resource types such as `Quote`. Install
and import `npubcash-types` directly when explicit resource types are needed.
