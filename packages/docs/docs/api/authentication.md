# Authentication <Badge type="warning" text="npubcash v2" />

Most endpoints of the API are protected and accept either one of two authentication headers

## NIP-98 Auth

NIP-98 Auth is the basic authentication method inside npub.cash.
It requires a valid NIP-98 header on every request.
The exact format of the header is specified in the [nips repository](https://github.com/nostr-protocol/nips/blob/master/98.md).

The generated token is then included as the `Authorization` header in the request.

```
GET /api/v2/wallet/quotes
Authorization: Nostr eyJpZCI6ImZlOTY0ZTc1ODkwMzM...
```

:::warning
NIP-98 headers need to be recreated for every request.
If you are using a signing extension, this can lead to a lot of pop-ups.
Consider using JWT Auth instead.
:::

## JWT Auth

With JWT Auth users obtain a bearer authentication token that can then be used to
authenticate subsequent requests. The initial request for the token needs to be authenticated
with a [NIP-98](#nip-98-auth) Auth header.

```
GET /api/v2/auth/nip98
Authorization: Nostr eyJpZCI6ImZlOTY0ZTc1ODkwMzM...
```

The server will respond with a JSON payload including the token:

```json
{
  "error": false,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR..."
  }
}
```

The bearer token retrieved from this endpoint must then be used to authenticate subsequent
requests by including it as the `Authorization` header.

```
GET /api/v2/wallet/quotes
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR...
```

:::tip
JWT tokens are valid for 30 minutes. The SDK automatically handles token refresh, but if you're using the API directly, you'll need to request a new token when it expires.
:::

## Token Expiration

JWT tokens have a 30-minute lifetime. When a token expires, you'll receive a `401 Unauthorized` response. To continue making requests:

1. Request a new JWT token using NIP-98 authentication
2. Use the new token for subsequent requests

The SDK handles this automatically, but when using the API directly, you'll need to implement token refresh logic.

## Example: Using JWT Auth

Here's a complete example of using JWT authentication:

```bash
# Step 1: Get JWT token with NIP-98
curl -X GET "https://npub.cash/api/v2/auth/nip98" \
  -H "Authorization: Nostr eyJpZCI6ImZlOTY0ZTc1ODkwMzM..."

# Response:
# {
#   "error": false,
#   "data": {
#     "token": "eyJhbGciOiJIUzI1NiIsInR..."
#   }
# }

# Step 2: Use JWT token for API requests
curl -X GET "https://npub.cash/api/v2/wallet/quotes" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR..."
```

## Security Considerations

- **Never share your private key** - Keep your nostr private key secure
- **Use HTTPS** - Always connect to npubcash servers over HTTPS
- **Token storage** - If storing JWT tokens, use secure storage (not localStorage for sensitive apps)
- **Token expiration** - JWT tokens expire quickly for security; implement proper refresh logic
- **Signing extensions** - Be cautious with browser extensions that request signing permissions
