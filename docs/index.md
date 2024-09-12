# Welcome to the docs

Welcome to the documentation of npubcash-server, an innovative Lightning Address / LNURL server accessible to everyone.
It is able to receive Lightning Address payments for nostr profiles, without requiring a registration, by building on
nostr HTTP auth. Payments are stored as Cashu token and can be withdrawn anytime by providing a
valid signature.

## Benefits of npubcash vs. traditional custodial ln addresses

- Privacy: Thanks to Cashu, your financial activities are not visible to your custodian. This added layer of privacy ensures that your transactions remain your own.

- No User Exclusion: Custodians cannot exclude individual users.
  Because Cashu mints can not differentiate between users they can not censor individuals

  ***

**npubcash-server** provides an API for wallets and other apps to integrate
a Cashu-based Lightning Address. The API reference can be found [here](/api)
