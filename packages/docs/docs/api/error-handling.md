# Error Handling <Badge type="warning" text="npubcash v2" />

This guide covers how to handle errors when working with the npubcash API.

## Error Response Format

All API endpoints return errors in a consistent JSON format:

```json
{
  "error": true,
  "message": "Human-readable error description"
}
```

## HTTP Status Codes

The API uses standard HTTP status codes to indicate the type of error:

### 200 OK
Request succeeded. The response body contains the requested data.

### 400 Bad Request
The request was malformed or contained invalid parameters.

**Example:**
```json
{
  "error": true,
  "message": "Invalid mint URL format"
}
```

### 401 Unauthorized
Authentication is required or the provided authentication token is invalid.

**Common causes:**
- Missing `Authorization` header
- Invalid NIP-98 signature
- Expired JWT token
- Malformed authentication token

**Example:**
```json
{
  "error": true,
  "message": "Invalid or expired authentication token"
}
```

### 403 Forbidden
The request is authenticated but the user is not authorized to perform this action.

**Example:**
```json
{
  "error": true,
  "message": "Quotes are locked"
}
```

### 404 Not Found
The requested resource does not exist.

**Example:**
```json
{
  "error": true,
  "message": "Quote not found"
}
```

### 500 Internal Server Error
An unexpected error occurred on the server.

**Example:**
```json
{
  "error": true,
  "message": "Internal server error"
}
```

## Handling Errors in Code

### Using the SDK

The SDK automatically handles HTTP errors and throws exceptions:

```typescript
import { NPCClient, JWTAuthProvider } from "npubcash-sdk";

const client = new NPCClient(baseUrl, authProvider);

try {
  const quotes = await client.getAllQuotes();
} catch (error) {
  if (error instanceof Error) {
    console.error("Error fetching quotes:", error.message);
    }
  }
```

### Using Fetch Directly

When using `fetch` directly, check the response status:

```typescript
async function getQuotes() {
  const response = await fetch("https://npub.cash/api/v2/wallet/quotes", {
    headers: {
      "Authorization": "Bearer " + token
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.data;
}
```

### WebSocket Errors

WebSocket errors are handled via the error callback:

```typescript
const dispose = client.subscribe(
  (quoteId) => {
    console.log("Quote updated:", quoteId);
  },
  (error) => {
    console.error("WebSocket error:", error);
    // Handle reconnection logic
  }
);
```

## Common Error Scenarios

### Authentication Failures

**Problem:** `401 Unauthorized` errors

**Solutions:**
1. Ensure the `Authorization` header is included
2. For NIP-98: Verify the signature is valid and the event is properly formatted
3. For JWT: Check if the token has expired and request a new one
4. Verify the server URL is correct

**Example:**
```typescript
// Refresh JWT token if expired
try {
  await client.getAllQuotes();
} catch (error) {
  if (error.message.includes("401")) {
    // Re-authenticate to get a new token
    const newAuth = new JWTAuthProvider(baseUrl, signer);
    client.setAuthProvider(newAuth);
  }
}
```

### Invalid Data

Validate data before sending requests:

```typescript
function setMintUrl(mintUrl: string) {
  // Validate URL format
  try {
    new URL(mintUrl);
  } catch {
    throw new Error("Invalid mint URL format");
  }

  return client.settings.setMintUrl(mintUrl);
}
```

## Debugging Tips

1. **Check the error message** - it often contains helpful information
2. **Verify authentication** - ensure tokens are valid and not expired
3. **Check request format** - verify headers, body, and URL are correct
4. **Review server logs** - if you have access, check server-side logs
5. **Test with curl** - verify the API works outside your application

```bash
# Test authentication
curl -X GET "https://npub.cash/api/v2/auth/nip98" \
  -H "Authorization: Nostr YOUR_TOKEN"

# Test endpoint
curl -X GET "https://npub.cash/api/v2/wallet/quotes" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -v  # Verbose output for debugging
```
