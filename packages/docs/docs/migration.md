# Production migration <Badge type="danger" text="v1 migration required by August 7, 2026 at 15:00 UTC" />

We plan to consolidate the two public npub.cash services on
**August 7, 2026 at 15:00 UTC**. After the cutover, both `npub.cash` and
`npubx.cash` will point to the v2 service that currently serves `npubx.cash`.

## What is changing

| Domain | Before the cutover | After the cutover |
| --- | --- | --- |
| `npub.cash` | v1 service | Canonical v2 service |
| `npubx.cash` | v2 service | Temporary compatibility domain for the same v2 service |

The v1 and v2 APIs are **not backward compatible**. The v1 API will no longer
be available through `npub.cash` after the cutover.

The consumer API continues to use `/api/v2`. After the cutover, `npub.cash` is
the canonical domain for Lightning addresses and API access.

::: warning npubx.cash retirement
`npubx.cash` will remain available as a compatibility domain through
**December 31, 2026**. Migrate Lightning addresses and API configurations to
`npub.cash` before it is retired.
:::

## If you use `npub.cash` (v1)

You must migrate to v2 before the cutover. This is not only an endpoint change:
the consumer becomes responsible for minting and storing proofs.

| Consumer concern | v1 | v2 |
| --- | --- | --- |
| What npub.cash returns | A token containing proofs | Paid mint quote metadata |
| Who turns payment into proofs | npub.cash before the consumer claims | **The consumer, directly with the mint** |
| Where proofs are stored | npub.cash until claimed | **The consumer's wallet** |
| How collection is tracked | npub.cash claim and withdrawal state | **The consumer records minted quotes and wallet balance** |

There is no v2 replacement for `/api/v1/claim` that returns a Cashu token, and
the v1 balance model does not carry over. In v2, npub.cash reports paid quotes;
the consumer's wallet is the source of truth for proofs and spendable balance.

### Required v2 collection flow

For each authenticated user, the consumer must:

1. Fetch paid quotes from `GET /api/v2/wallet/quotes`, following pagination.
   Synchronize on startup and periodically. WebSocket updates can reduce
   latency, but they are non-durable hints; retry if an updated quote is not
   immediately visible through HTTP.
2. For each quote not completed locally, use its `mintUrl` and `quoteId` with a
   Cashu wallet to mint proofs directly from that mint.
3. If `locked` is `true`, use a wallet that supports NUT-20 and can provide the
   required signatures.
4. Durably store the resulting proofs in the consumer's wallet.
5. Record `(mintUrl, quoteId)` as completed only after the proofs are stored.
   Store both atomically where possible.
6. Reconcile interrupted mint attempts with the mint before retrying.

npub.cash continues returning paid quotes after they have been minted or spent,
and their state may remain `PAID`. Do not try to mint every quote again during
each synchronization; use the consumer's durable completion state.

The npub.cash SDK retrieves quotes and sends update notifications. It does not
mint quotes into proofs or store those proofs for the consumer. Use a Cashu
wallet library for that part of the flow.

### Recommended dual-service transition

To avoid coordinating a client release exactly at the cutoff on August 7, 2026
at 15:00 UTC, deploy a client that supports both services before the migration:

1. Keep the v1 claim flow against `npub.cash` for proofs held by the v1 service.
2. In parallel, run the v2 quote flow against `npubx.cash`, minting and storing
   proofs as described above.
3. Keep the completion state for the two flows separate.

At the cutover, the v1 endpoint on `npub.cash` will stop working while the v2
flow through `npubx.cash` continues. Retire the v1 adapter based on the
published cutoff or an explicit client configuration. A `404 Not Found` or
`410 Gone` after the cutoff can confirm retirement, but clients should not rely
on a particular status code. Timeouts and `5xx` responses may be temporary;
authentication errors require normal remediation. None of these failures alone
should be treated as evidence that v1 was retired.

After the cutover, v2 quotes are available through both domains. If a client
temporarily synchronizes through both, it must deduplicate quotes by
`(mintUrl, quoteId)`, not by API hostname.

Before the cutover:

1. Integrate and test against `https://npubx.cash`, which already provides the
   v2 service that will remain after the cutover.
2. Add the v2 collection flow alongside the existing v1 claim and balance flow.
   Integrate the [v2 quote endpoint](/docs/api/endpoints#get-quotes) and
   [v2 authentication](/docs/api/authentication).
3. Test multiple mints if supported; select the wallet using each quote's
   `mintUrl` rather than assuming one configured mint.
4. Verify that proofs survive a restart, completed quotes are not minted twice,
   and interrupted mint attempts recover safely.
5. Make the service base URL configurable. Test against `npubx.cash` before the
   cutover, then use the canonical `https://npub.cash` API after the cutover.
6. Keep both flows active through the cutoff, then retire the v1 adapter after
   the cutover is confirmed.

If your client cannot support this flow before the cutover, disable its
npub.cash integration until it supports v2.

## User funds

Funds held by the legacy npub.cash service will be migrated gradually and
automatically after the cutoff. Users do not need to trigger the migration,
but the process will not complete immediately.

Because npub.cash predates v1 and has changed many times since its initial
release, we will thoroughly scan the old database and check the state of every
proof. This includes looking for recoverable sats that may have been considered
lost when a user initiated a withdrawal but never claimed the associated
proofs.

The dataset is large, and checking proof states requires communication with the
mint. The migration will therefore proceed deliberately so we can be thorough
and preserve npub.cash users' privacy with respect to the mint.

## If you use `npubx.cash` (v2)

The v2 API does not change, but you should migrate to the canonical
`npub.cash` domain. `npubx.cash` will remain available only as a compatibility
domain through December 31, 2026.

Prepare before the cutover:

1. Make the API base URL and published Lightning-address domain configurable.
2. Plan to switch both to `npub.cash` after 15:00 UTC on August 7, 2026.
3. Generate new NIP-98 events for the `npub.cash` API URLs and reconnect any
   WebSocket subscriptions through `npub.cash`.
4. Smoke-test authentication and quote retrieval after switching.

## Choosing domains after the cutover

The Lightning address domain and the wallet's API domain are independent. An
incoming quote is associated with the recipient's Nostr public key, not the
domain used in the Lightning address. The wallet retrieves that quote by
authenticating as the same public key.

During the compatibility period, both domains reach the same service. This
means a payment to `<user>@npub.cash` can be retrieved through the API at
`https://npubx.cash`, and a payment to `<user>@npubx.cash` can be retrieved
through `https://npub.cash`. This allows Lightning addresses and wallet API
configurations to be migrated separately.

Cross-domain access is transitional behavior, not the recommended final
configuration. Use `npub.cash` for both new Lightning addresses and wallet API
configurations, and migrate existing `npubx.cash` usage by December 31, 2026.

NIP-98 events authorize an exact URL. When changing between `npubx.cash` and
`npub.cash`, generate new NIP-98 events and reconnect WebSocket subscriptions
through the new host. Within a wallet, use one API base URL consistently for
HTTP, WebSocket, and authentication calls. Clients using the TypeScript SDK
must give the same base URL to `NPCClient` and `JWTAuthProvider`; the provider
will obtain a JWT as needed.
