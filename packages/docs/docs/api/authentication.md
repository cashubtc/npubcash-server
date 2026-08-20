# Authentication

Protected endpoints accept either a NIP-98 authorization event or a JWT bearer
token obtained with NIP-98.

## NIP-98

NIP-98 signs the exact request URL and HTTP method with a Nostr key. The event
must be regenerated when the URL or method changes. Follow the canonical
[NIP-98 specification](https://github.com/nostr-protocol/nips/blob/master/98.md)
when constructing events.

Send the encoded event in the `Authorization` header:

```http
GET /api/v2/wallet/quotes HTTP/1.1
Host: npub.cash
Authorization: Nostr eyJpZCI6ImZlOTY0ZTc1ODkwMzM...
```

NIP-98 works for every protected HTTP endpoint, but signing every request can
be disruptive when a browser extension asks the user for approval. Most clients
should exchange one NIP-98 event for a short-lived JWT.

## JWT bearer tokens

Request a JWT by authenticating `GET /api/v2/auth/nip98` with NIP-98:

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

Use the token for subsequent requests:

```http
GET /api/v2/wallet/quotes HTTP/1.1
Host: npub.cash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR...
```

JWTs expire after 30 minutes and are bound to the `User-Agent` header used when
they were issued. Keep that header stable while using a token. Request a new
token with NIP-98 after expiration.

The SDK's `JWTAuthProvider` handles the exchange and refreshes its cached token
automatically.

## WebSocket authentication

The quote WebSocket cannot use a JWT bearer token. After connecting, sign the
URL and method supplied in the server's challenge and return the resulting
NIP-98 token. See the [WebSocket protocol](./endpoints.md#quote-updates-over-websocket)
for the exact message shapes.

## Security guidance

- Never send a Nostr private key to the server or include it in application logs.
- Use HTTPS and WSS outside local development.
- Store bearer tokens in memory where possible and avoid persistent browser
  storage for sensitive applications.
- Generate NIP-98 events for the exact public URL, including its scheme and
  hostname.
- Treat the signer prompt as a security boundary: show users what origin and
  action they are authorizing.
