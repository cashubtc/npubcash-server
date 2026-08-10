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
