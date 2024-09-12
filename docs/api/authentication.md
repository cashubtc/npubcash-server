# Authentication

Most of the exposed endpoints are protected and require and authenticated request.
npubcash-server uses [NIP-98](https://github.com/nostr-protocol/nips/blob/master/98.md) HTTP Auth for this.
That way there is no need to sign up before using the service.

Developers should look up the official NIP-98 spec when implementing npubcash,
but here is a quick overview:

1. Wallet wants to check npubcash balance
2. Wallet creates a nostr event as per NIP-98, signs it using the users private key
   and serialises
3. Wallet attaches the serialised event as Authentication header to the request
4. npubcash-server decodes the header, checks the public key and verifies the signature
