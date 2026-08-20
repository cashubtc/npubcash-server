# How it works

npubcash combines Lightning Address discovery, Nostr identity, and Cashu mint
quotes. It coordinates incoming payments without operating a custodial wallet
balance for each recipient.

## Identity

An `npub1...` Nostr public key is immediately usable as the local part of an
npubcash Lightning Address:

```text
npub1mhcr4j594hsrnen594d7700n2t03n8gdx83zhxzculk6sh9nhwlq7uc226@npub.cash
```

No account registration is needed. The server decodes the `npub` and associates
incoming mint quotes with its underlying public key. Operators may also enable
paid usernames, which resolve to the same Nostr identity through Lightning
Address and NIP-05 endpoints.

Protected wallet and settings requests use NIP-98. Clients may exchange one
NIP-98 event for a short-lived JWT to avoid signing every HTTP request.

## Incoming payment

1. A payer resolves `<recipient>@npub.cash` through LNURL-pay.
2. npubcash determines the recipient's configured mint and locking preference.
3. The server requests a BOLT11 mint quote and returns its invoice to the payer.
4. Quote monitoring observes the mint until the invoice is paid or expires.
5. The paid quote is stored with the recipient's public key and published to
   connected quote-update subscribers.

## Collecting a payment

The authenticated recipient retrieves paid quote metadata from
`GET /api/v2/wallet/quotes`. The response identifies the mint, quote ID, amount,
invoice, state, and whether the quote was locked.

The recipient's wallet—not npubcash-server—uses that quote with the identified
mint to issue Cashu proofs. This separation means:

- the consumer must support the mint-quote issuance flow;
- the consumer must persist its Cashu wallet state safely;
- the consumer must track processed `(mintUrl, quoteId)` pairs; and
- changing the preferred mint affects only future incoming payments.

The server intentionally keeps paid quotes in history after collection, making
recovery possible but requiring idempotent consumer logic.
