# API Endpoints <Badge type="warning" text="npubcash v2" />

This document provides a comprehensive reference for all npubcash-server v2 API endpoints.

## Base URL

All API endpoints are prefixed with `/api/v2`. For example, if your server is hosted at `https://npub.cash`, the full URL for the quotes endpoint would be `https://npub.cash/api/v2/wallet/quotes`.

## Authentication

Most endpoints require authentication. See the [Authentication guide](./authentication.md) for details on NIP-98 and JWT authentication methods.

## Wallet Endpoints

### Get Quotes

Retrieve paid mint quotes associated with the authenticated user. Consumers
must mint these quotes directly with the mint identified by `mintUrl`.

**Endpoint:** `GET /api/v2/wallet/quotes`

**Authentication:** Required (NIP-98 or JWT Bearer)

**Query Parameters:**

- `since` (optional): Return quotes paid after this Unix timestamp in seconds.
- `limit` (optional): Page size. Defaults to 50.
- `offset` (optional): Number of quotes to skip. Defaults to 0.

**Response:**

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

Follow pagination until the number of retrieved quotes reaches
`metadata.total`. The server continues to return paid quotes after a consumer
has minted them, so consumers must durably track completed `(mintUrl, quoteId)`
pairs.

**Example:**

```bash
# Using JWT Bearer token
curl -X GET "https://npub.cash/api/v2/wallet/quotes" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR..."

# Using NIP-98
curl -X GET "https://npub.cash/api/v2/wallet/quotes" \
  -H "Authorization: Nostr eyJpZCI6ImZlOTY0ZTc1ODkwMzM..."

# With pagination and a paid-at watermark
curl -X GET "https://npub.cash/api/v2/wallet/quotes?since=1234567890&limit=50&offset=0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR..."
```

## Settings Endpoints

### Update Mint URL

Set or update the mint URL for the authenticated user.

**Endpoint:** `PUT /api/v2/settings/mint`

**Authentication:** Required (NIP-98 or JWT Bearer)

**Request Body:**

```json
{
  "mintUrl": "https://mint.example"
}
```

**Response:**

```json
{
  "error": false,
  "data": {
    "pubkey": "npub1...",
    "mintUrl": "https://mint.example",
    "lockQuotes": false
  }
}
```

**Example:**

```bash
curl -X PUT "https://npub.cash/api/v2/settings/mint" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR..." \
  -H "Content-Type: application/json" \
  -d '{"mintUrl": "https://mint.example"}'
```

### Lock/Unlock Quotes

Lock or unlock quotes for the authenticated user. When locked, quotes cannot be claimed.

**Endpoint:** `PUT /api/v2/settings/lock`

**Authentication:** Required (NIP-98 or JWT Bearer)

**Request Body:**

```json
{
  "lockQuotes": true
}
```

**Response:**

```json
{
  "error": false,
  "data": {
    "pubkey": "npub1...",
    "mintUrl": "https://mint.example",
    "lockQuotes": true
  }
}
```

**Example:**

```bash
curl -X PUT "https://npub.cash/api/v2/settings/lock" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR..." \
  -H "Content-Type: application/json" \
  -d '{"lockQuotes": true}'
```

## Authentication Endpoints

### Get JWT Token

Exchange a NIP-98 authentication header for a JWT bearer token.

**Endpoint:** `GET /api/v2/auth/nip98`

**Authentication:** Required (NIP-98 only)

**Response:**

```json
{
  "error": false,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR..."
  }
}
```

**Example:**

```bash
curl -X GET "https://npub.cash/api/v2/auth/nip98" \
  -H "Authorization: Nostr eyJpZCI6ImZlOTY0ZTc1ODkwMzM..."
```

The returned token can be used as a Bearer token for subsequent requests:

```bash
curl -X GET "https://npub.cash/api/v2/wallet/quotes" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR..."
```

## WebSocket Endpoints

### Quote Updates

Subscribe to real-time quote updates via WebSocket.

**Endpoint:** `wss://npub.cash/api/v2/ws/quote`

**Authentication:** NIP-98 challenge/response

**Protocol:**

1. Client connects to the WebSocket endpoint
2. Server sends a challenge message:
   ```json
   {
     "type": "challenge",
     "challenge": "random-challenge-string"
   }
   ```
3. Client responds with a NIP-98 signed authentication:
   ```json
   {
     "type": "auth",
     "token": "Nostr eyJpZCI6ImZlOTY0ZTc1ODkwMzM..."
   }
   ```
4. Server validates and sends confirmation:
   ```json
   {
     "type": "ok"
   }
   ```
5. Server sends update messages when quotes change:
   ```json
   {
     "type": "update",
     "quoteId": "quote-id-123"
   }
   ```

**Example (JavaScript):**

```javascript
const ws = new WebSocket("wss://npub.cash/api/v2/ws/quote");

ws.onmessage = async (event) => {
  const message = JSON.parse(event.data);

  if (message.type === "challenge") {
    // Sign the challenge using NIP-98
    const token = await signNip98Challenge(message.challenge);
    ws.send(
      JSON.stringify({
        type: "auth",
        token: token,
      })
    );
  } else if (message.type === "update") {
    console.log("Quote updated:", message.quoteId);
  }
};
```

## Lightning Address Endpoints

### LNURL Pay Request

Handle Lightning Address payment requests (LUD-16).

**Endpoint:** `GET /.well-known/lnurlp/{npub}`

**Authentication:** Not required (public endpoint)

**Path Parameters:**

- `npub`: Nostr public key (npub format)

**Query Parameters:**

- `amount` (optional): Amount in millisatoshis

**Response:**

```json
{
  "tag": "payRequest",
  "commentAllowed": 0,
  "callback": "https://npub.cash/api/v2/lnurl/{npub}",
  "metadata": "[[\"text/plain\",\"Payment to npub1...\"]]",
  "minSendable": 1000,
  "maxSendable": 1000000
}
```

**Example:**

```bash
curl "https://npub.cash/.well-known/lnurlp/npub1mhcr4j594hsrnen594d7700n2t03n8gdx83zhxzculk6sh9nhwlq7uc226"
```

### LNURL Callback

Generate a Lightning invoice for a payment request.

**Endpoint:** `GET /api/v2/lnurl/callback/{npub}`

**Authentication:** Not required (public endpoint)

**Path Parameters:**

- `npub`: Nostr public key (npub format)

**Query Parameters:**

- `amount`: Amount in millisatoshis (required)

**Response:**

```json
{
  "status": "OK",
  "pr": "lnbc10u1p3...",
  "routes": []
}
```

**Example:**

```bash
curl "https://npub.cash/api/v2/lnurl/callback/npub1...?amount=100000"
```

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": true,
  "message": "Error description"
}
```

**Common HTTP Status Codes:**

- `200 OK`: Request succeeded
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required or invalid
- `403 Forbidden`: Authenticated but not authorized
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

**Example Error Response:**

```json
{
  "error": true,
  "message": "Invalid authentication token"
}
```
