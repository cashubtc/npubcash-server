# Getting Started <Badge type="warning" text="npubcash v2" />

Welcome to npubcash! This guide will help you get started with receiving Lightning payments using your nostr identity.

## What is npubcash?

npubcash is a Lightning address service powered by Cashu and nostr. It allows anyone with a nostr identity to receive Lightning payments without any registration or setup.

Your Lightning address is simply your nostr public key (npub) followed by `@npub.cash`:

```
npub1mhcr4j594hsrnen594d7700n2t03n8gdx83zhxzculk6sh9nhwlq7uc226@npub.cash
```

## Quick Start

### 1. Get Your Lightning Address

Your Lightning address is automatically available once you have a nostr public key. No sign-up required!

Format: `{your-npub}@npub.cash`

Example:
```
npub1mhcr4j594hsrnen594d7700n2t03n8gdx83zhxzculk6sh9nhwlq7uc226@npub.cash
```

### 2. Share Your Address

Share your Lightning address with anyone who wants to send you payments. They can use any Lightning wallet that supports Lightning Addresses (LUD-16).

### 3. Receive Payments

When someone sends a payment to your Lightning address:

1. The server creates a Lightning invoice
2. The payer pays the invoice
3. The payment is stored and associated with your nostr public key
4. You can claim the funds later

### 4. Claim Your Funds

To claim your funds, you'll need to:

1. Authenticate using your nostr key (NIP-98)
2. Retrieve your saved quotes
3. Redeem the quotes at your preferred Cashu mint

## Using the SDK

The easiest way to interact with npubcash is using the official SDK:

```bash
npm install npubcash-sdk
```

```typescript
import { NPCClient, JWTAuthProvider } from "npubcash-sdk";

// Set up authentication
const auth = new JWTAuthProvider("https://npub.cash", signer);

// Create client
const client = new NPCClient("https://npub.cash", auth);

// Get your quotes
const quotes = await client.getAllQuotes();
```

See the [SDK documentation](./sdk/npubcash-sdk.md) for more details.

## Using the API Directly

If you prefer to use the API directly, you'll need to:

1. Authenticate using NIP-98 or JWT
2. Make requests to the API endpoints

See the [API Reference](./api/endpoints.md) for endpoint details.

## Setting Up Your Mint

npub.cash Servers define a default mint, but you can change it at any time (funds already received are bound to the mint they were received with)

```typescript
await client.settings.setMintUrl("https://your-mint.example");
```

This tells the server where to create invoices and where you'll redeem your tokens.

## Next Steps

- Read [How does it work?](./how-does-it-work.md) to understand the architecture
- Check out the [API Reference](./api/endpoints.md) for all available endpoints
- Explore the [SDK documentation](./sdk/npubcash-sdk.md) for client usage
- Learn about [Authentication](./api/authentication.md) methods

## Common Questions

### Do I need to register?

No! Your nostr public key is your identity. No registration required.

### How do I get my nostr public key?

If you use a nostr client (like Damus, Amethyst, or others), your public key is already available. It's usually displayed as an `npub1...` string.

### Can I use any Cashu mint?

Yes! You can configure any Cashu mint URL that you trust. The server will create invoices from that mint.

### What happens if I lose my nostr key?

Your nostr key is your identity. If you lose access to it, you'll lose access to your npubcash account and any unclaimed funds. Make sure to back up your key securely.

### Is there a fee?

The npubcash service itself is free. However, Lightning network fees apply when sending payments.
