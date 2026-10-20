# npub.cash Server

The npub.cash server enables Nostr identities to receive payments through LNURL and manage the resulting wallet funds.

## Language

**Recipient**:
A Nostr identity that can receive payments through the server's LNURL interface.
_Avoid_: User, account

**Recipient Address**:
An npub or claimed username through which an LNURL request identifies a Recipient.

**Unavailable Recipient Address**:
A Recipient Address for which the server will not offer LNURL payment discovery, either because it is unknown or because its Public Key has an LNURL Recipient Block.
_Avoid_: User not found, blacklisted user

**LNURL Recipient Block**:
The prospective exclusion of a Recipient from LNURL discovery and from obtaining new payment requests. It neither invalidates previously issued invoices nor suspends that identity from other server capabilities.
_Avoid_: Blacklist, blacklisted user, banned user

**Public Key**:
The canonical Nostr identity of a Recipient, independent of how that identity is presented or addressed.
_Avoid_: npub, username

**npub**:
A human-readable encoding of a Public Key. It represents an identity but is not itself the canonical identity.

**Mint Quote**:
The server's persisted representation of a Cashu mint quote created for a Recipient's payment request.
_Avoid_: Invoice, payment

**Pollable Mint Quote**:
A Mint Quote whose local state is `UNPAID` and which remains eligible for authoritative reconciliation with its mint.
_Avoid_: Pending quote, active subscription

**Quote Observation**:
A report from a mint about the current condition of a Mint Quote. It is untrusted until reconciled with the persisted Mint Quote.
_Avoid_: Quote update, event

**Quote State Change**:
A persisted transition of a Mint Quote's local business state. A Quote State Change may result from a Quote Observation, but duplicate or non-authoritative observations do not create one.
_Avoid_: Quote Observation, notification
