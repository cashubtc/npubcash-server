# How does it work? <Badge type="warning" text="npubcash v2" />

npub.cash is a Lightning address powered by Cashu and nostr. It lets anyone receive Lightning payments to a LUD‑16 address without registration.

## Identity

npub.cash uses nostr identities. Your nostr public key becomes your address.

A npub.cash Lightning address looks like this:

```text
npub1mhcr4j594hsrnen594d7700n2t03n8gdx83zhxzculk6sh9nhwlq7uc226@npub.cash
```

Any nostr public key is a valid npub.cash address. The server associates incoming payments with the provided public key.

To retrieve your saved payments you authenticate using a NIP‑98 header. The server validates the header, extracts your public key, looks up saved payments for that key, and returns them.

Because identity comes from nostr, npub.cash requires no sign‑up or setup—nostr users can use it immediately.

## Payments

npub.cash uses Cashu to handle payments.

1. A payer sends a Lightning address request to the server for your nostr key.
2. The server requests a Cashu BOLT11 quote from its configured mint.
3. The mint returns a Lightning invoice; the server forwards this invoice to the payer.
4. The server monitors the invoice status. When it is paid, the server stores the paid quote and associates it with your public key.

Later, you can claim funds by authenticating (NIP‑98) and requesting your saved quotes from the server.
