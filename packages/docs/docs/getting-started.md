# Getting started <Badge type="warning" text="npubcash v2" />

npubcash lets a Nostr identity receive Lightning payments through a Lightning
Address. No npubcash registration is required for an `npub` address.

## Receive a payment

Your address is your Nostr public key followed by `@npub.cash`:

```text
npub1mhcr4j594hsrnen594d7700n2t03n8gdx83zhxzculk6sh9nhwlq7uc226@npub.cash
```

Share it with a payer using a wallet that supports Lightning Addresses
(LUD-16). The payment flow is:

1. The payer's wallet discovers your address through LNURL-pay.
2. npubcash requests a BOLT11 mint quote from your configured Cashu mint.
3. The payer pays the invoice.
4. npubcash records the paid mint-quote metadata for your Nostr public key.
5. Your wallet retrieves the quote and mints Cashu proofs directly from that
   mint.

npubcash stores the quote needed to mint proofs; it does not hold a wallet
balance on your behalf.

## Retrieve paid quotes with the SDK

Install the client:

```bash
npm install npubcash-sdk
```

Then provide a Nostr signer and create a client:

<<< ../examples/sdk-quick-start.ts

See the [SDK guide](./sdk/npubcash-sdk.md) for settings, subscriptions, errors,
and username payments.

## Retrieve paid quotes over HTTP

API clients can authenticate each request with NIP-98 or exchange NIP-98 for a
short-lived JWT. Start with the [Authentication guide](./api/authentication.md),
then call the [wallet endpoint](./api/endpoints.md#list-paid-mint-quotes).

## Choose a mint

Each server defines a default mint. Authenticated users can choose a different
mint for future payments:

```ts
await client.settings.setMintUrl("https://mint.example");
```

Existing quotes remain bound to the mint that issued them. Use a mint you trust
and retain the `mintUrl` alongside every processed quote.

## Keep collection idempotent

Quote history is not an acknowledgment queue: processed quotes remain visible.
Before minting, check whether the `(mintUrl, quoteId)` pair was already handled;
after minting, durably record that pair together with the wallet state.

## Next steps

- Read [How it works](./how-does-it-work.md) for the complete payment model.
- Use the [API reference](./api/endpoints.md) for routes and response formats.
- Review [Error handling](./api/error-handling.md) before implementing retries.
