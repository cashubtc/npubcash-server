# Error handling

npubcash uses two error formats: one for its authenticated JSON API and one for
the LNURL protocol.

## Authenticated API errors

Most `/api/v2` failures return an HTTP error status and a JSON body:

```json
{
  "error": true,
  "message": "Human-readable error description"
}
```

Common statuses include:

| Status | Meaning |
| --- | --- |
| `400 Bad Request` | Required input or headers are missing or invalid. |
| `401 Unauthorized` | The NIP-98 event or JWT is missing, invalid, or expired. |
| `402 Payment Required` | A username purchase requires a Cashu payment. |
| `404 Not Found` | The requested resource does not exist. |
| `409 Conflict` | The requested username is already taken. |
| `500 Internal Server Error` | The server could not complete the request. |

A `402` response also exposes an encoded Cashu payment request through the
`X-Cashu` response header.

## LNURL errors

LNURL discovery and invoice failures follow the LNURL error shape:

```json
{
  "status": "ERROR",
  "reason": "Invalid recipient."
}
```

Some recipient errors intentionally use HTTP 200 because LNURL clients inspect
the response body. Do not rely on the HTTP status alone for LNURL requests.

## SDK errors

SDK HTTP methods throw `ApiError`, which exposes both `message` and
`statusCode`. A username request that receives `402` throws
`PaymentRequiredError`; its `paymentRequest` property contains the decoded Cashu
payment request.

<<< ../../examples/sdk-errors.ts

The SDK authentication provider automatically requests another JWT after its
cached token expires. Create a new client/provider only when changing the
server, signer, or authentication strategy.

## Direct fetch

```ts
async function getQuotes(token: string) {
  const response = await fetch("https://npub.cash/api/v2/wallet/quotes", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message ?? `HTTP ${response.status}`);
  }
  return body.data.quotes;
}
```

For WebSocket connections, handle `error` messages and transport errors through
the SDK's optional `onError` callback. Reconnect by creating a new subscription;
the current subscription manager does not reconnect automatically.
