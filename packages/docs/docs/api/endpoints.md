# API reference

The HTTP API is available as an [interactive reference](/api-reference.html)
generated from the machine-readable [OpenAPI document](/openapi.yaml).
Authenticated endpoints accept either a NIP-98 authorization event or a JWT
issued by the authentication endpoint. See [Authentication](./authentication.md)
for the complete flow.

Examples below use `https://npub.cash` as the server URL. Self-hosted instances
should replace it with their own origin.

## Wallet

### List paid mint quotes

`GET /api/v2/wallet/quotes`

Returns mint quotes belonging to the authenticated user whose state is `PAID`,
`ISSUED`, or `INFLIGHT`. Consumers mint these quotes directly with the mint in
`mintUrl`.

Query parameters:

| Name | Required | Description |
| --- | --- | --- |
| `since` | No | Return quotes paid after this Unix timestamp, in seconds. |
| `limit` | No | Page size from 1 to 1000. The server caps it at 50. Defaults to 50. |
| `offset` | No | Number of matching quotes to skip. Defaults to 0. |

```bash
curl "https://npub.cash/api/v2/wallet/quotes?limit=50&offset=0" \
  -H "Authorization: Bearer $NPUBCASH_TOKEN"
```

```json
{
  "error": false,
  "data": {
    "quotes": [
      {
        "createdAt": 1752500000,
        "paidAt": 1752500030,
        "expiresAt": 1752586400,
        "mintUrl": "https://mint.example",
        "quoteId": "quote-id-123",
        "request": "lnbc10u1p3...",
        "amount": 1000,
        "state": "PAID",
        "locked": false
      }
    ]
  },
  "metadata": {
    "total": 1,
    "limit": 50
  }
}
```

Follow pagination until all `metadata.total` results have been read. Quotes
remain in this history after they have been minted or spent, so consumers must
durably record processed `(mintUrl, quoteId)` pairs.

## User

### Get user settings

`GET /api/v2/user/info`

Returns the authenticated user's current mint, quote-locking preference, and
optional username. A default user resource is returned when no settings have
been saved yet.

```bash
curl https://npub.cash/api/v2/user/info \
  -H "Authorization: Bearer $NPUBCASH_TOKEN"
```

```json
{
  "error": false,
  "data": {
    "user": {
      "pubkey": "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      "mintUrl": "https://mint.example",
      "lockQuote": false
    }
  }
}
```

### Set the preferred mint

`PATCH /api/v2/user/mint`

The mint is used for future incoming payments. Existing quotes remain bound to
the mint that created them.

```bash
curl -X PATCH https://npub.cash/api/v2/user/mint \
  -H "Authorization: Bearer $NPUBCASH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mint_url":"https://mint.example"}'
```

The response uses the same `{ "error": false, "data": { "user": ... } }`
shape as the user-info endpoint.

### Configure quote locking

`PATCH /api/v2/user/lock`

When enabled, future quotes are created using the mint's supported locking
mechanism. Enabling this setting fails if the selected mint does not advertise
locking support.

```bash
curl -X PATCH https://npub.cash/api/v2/user/lock \
  -H "Authorization: Bearer $NPUBCASH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lockQuotes":true}'
```

### Purchase a username

`POST /api/v2/user/username`

Username purchases are available only when the server operator enables them.
The first request normally returns `402 Payment Required` with an encoded Cashu
payment request in the `X-Cashu` response header. Pay that request, then repeat
the request with the resulting Cashu token in an `X-Cashu` request header.

```bash
curl -i -X POST https://npub.cash/api/v2/user/username \
  -H "Authorization: Bearer $NPUBCASH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"alice"}'
```

```bash
curl -X POST https://npub.cash/api/v2/user/username \
  -H "Authorization: Bearer $NPUBCASH_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Cashu: cashuB..." \
  -d '{"username":"alice"}'
```

Successful purchases return `201 Created` and the updated user resource.

## Authentication

### Exchange NIP-98 for a JWT

`GET /api/v2/auth/nip98`

This endpoint requires NIP-98 authentication. It returns a JWT bound to the
request's `User-Agent` header and valid for 30 minutes.

```bash
curl https://npub.cash/api/v2/auth/nip98 \
  -H "Authorization: Nostr $NIP98_TOKEN"
```

```json
{
  "error": false,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR..."
  }
}
```

## Lightning Address and NIP-05

### Discover a Lightning Address

`GET /.well-known/lnurlp/{user}`

`user` may be an `npub1...` public key or a purchased username. The response's
`callback` points back to this same route.

```bash
curl https://npub.cash/.well-known/lnurlp/npub1...
```

```json
{
  "tag": "payRequest",
  "callback": "https://npub.cash/.well-known/lnurlp/npub1...",
  "metadata": "[[\"text/plain\",\"A cashu lightning address... Neat!\"]]",
  "minSendable": 1000,
  "maxSendable": 100000000
}
```

When Nostr zaps are enabled, the response also includes `allowsNostr: true` and
the server's `nostrPubkey`.

### Request an invoice

`GET /.well-known/lnurlp/{user}?amount={millisatoshis}`

Pass an integer amount within the discovery response's `minSendable` and
`maxSendable` range. An optional URL-encoded `nostr` query parameter may contain
a zap request when the server supports zaps.

```bash
curl "https://npub.cash/.well-known/lnurlp/npub1...?amount=100000"
```

```json
{
  "pr": "lnbc1...",
  "routes": []
}
```

LNURL errors use `{ "status": "ERROR", "reason": "..." }` rather than the
authenticated API's error shape.

### Resolve a NIP-05 username

`GET /.well-known/nostr.json?name={username}`

The `name` query parameter is optional. Omitting it or requesting an unknown
username returns empty `names` and `relays` maps.

```bash
curl "https://npub.cash/.well-known/nostr.json?name=alice"
```

```json
{
  "names": {
    "alice": "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"
  },
  "relays": {}
}
```

The endpoint currently reports an internal lookup failure with HTTP 200 and an
`{ "error": true, "message": "..." }` body, so clients should inspect the
response body before using the mappings.

## Quote updates over WebSocket

Connect to `wss://npub.cash/api/v2/ws/quote`. The server closes connections
that do not authenticate within 15 seconds.

1. The server supplies the exact URL and method to sign:

   ```json
   {
     "type": "challenge",
     "payload": {
       "url": "wss://npub.cash/api/v2/ws/quote",
       "method": "GET"
     }
   }
   ```

2. Sign a NIP-98 event for that URL and method, then respond:

   ```json
   {
     "type": "challenge-response",
     "payload": "Nostr eyJpZCI6ImZlOTY0ZTc1ODkwMzM..."
   }
   ```

3. A successful challenge receives:

   ```json
   { "type": "challenge-success" }
   ```

4. Quote changes are delivered as:

   ```json
   {
     "type": "update",
     "payload": {
       "quoteId": "quote-id-123"
     }
   }
   ```

The server may send `{ "type": "error", "payload": "..." }` when
authentication fails. The SDK's `subscribe` method implements this protocol.
Low-level clients may send `{ "type": "ping" }`; the server responds with
`{ "type": "pong" }`.
