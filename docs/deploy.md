# V3 operational notes

Use the maintained [deployment guide](../packages/docs/docs/server/deployment.md)
for installation, database, proxy, and environment configuration. The published
version is available on the
[documentation site](https://cashubtc.github.io/npubcash-server/docs/server/deployment).

This file retains fork-specific production deployment, mint-monitoring, and
v2-to-v3 cutover notes that are useful to operators of existing installations.

## Production deployments from the fork

The `prod` branch of `Egge21M/npubcash-server` deploys to the `npubcash-v3` Fly
app in Amsterdam using `fly.production.toml`. The default `fly.toml` targets
the separate `nightly-npubcash` SQLite app; always select the production config
explicitly for production commands.

The [Build workflow](../.github/workflows/build.yml) deploys a push to `prod`
only after its tests (including PostgreSQL integration tests), build, Docker
build, and production runtime checks succeed. Pull requests, other branches,
and other repositories do not deploy production. Deploy jobs run one at a time
and an active deployment is not canceled by a newer push.

### One-time setup

1. Enable GitHub Actions in the fork.
2. Log in with `fly auth login`, then inspect the existing app:

   ```sh
   fly status --app npubcash-v3
   fly secrets list --app npubcash-v3
   ```

   The app needs its production `DATABASE_URL`, `JWT_SECRET` (or `MNEMONIC`),
   and, with Nostr enabled, `ZAP_SECRET_KEY` (or `MNEMONIC`) and
   `DEFAULT_RELAYS`. These runtime secrets stay on Fly. Keep one application
   instance running: quote-monitor events are process-local. The workflow
   uses `--ha=false` to avoid creating a spare Machine; it does not scale down
   extra Machines that already exist.

3. Create an app-scoped deploy token and store it as the fork's Actions secret
   `FLY_API_TOKEN`. This Bash snippet passes the token directly to GitHub
   without printing it:

   ```bash
   (
     set -euo pipefail
     deploy_token="$(fly tokens create deploy --app npubcash-v3 --expiry 8760h)"
     test -n "$deploy_token"
     printf '%s' "$deploy_token" |
       gh secret set FLY_API_TOKEN --repo Egge21M/npubcash-server
   )
   ```

   Replace this token before its one-year expiry. An environment secret in
   the GitHub `production` environment also works; the deploy job uses that
   environment.

4. Push the workflow to `prod`. This starts CI and, when all checks pass, the
   first automated deployment. Follow the `Build` run in the fork's Actions
   tab and verify the release with `fly status --app npubcash-v3`.

### Releasing changes

Merge the changes intended for production into `prod` and push it to the
fork. Only code present on `prod` is released; updates to `v3` do not deploy
automatically. If a deployment fails after CI succeeds, fix the cause and
re-run the failed job for the current `prod` commit in GitHub Actions.

For a manual deployment of the checked-out revision, use:

```sh
fly deploy --config fly.production.toml --remote-only --ha=false
```

See Fly's [GitHub Actions deployment guide](https://fly.io/docs/launch/continuous-deployment-with-github-actions/)
for the token and workflow integration.

## Mint quote monitoring

The server keeps mint WebSocket subscriptions for active quotes and also polls
due `UNPAID` quotes from a persistent database queue. Polling selects rows by
oldest `last_polled_at` (never-polled rows first), discovers mint lanes before
claiming, and marks each per-mint claim before making requests. Expired unpaid
quotes remain pollable until the mint returns an authoritative state. A restart
resumes from the persisted polling timestamps.

The active controls are:

```env
MINT_QUOTE_ACTIVE_POLL_MS=20000
MINT_QUOTE_REQUEST_TIMEOUT_MS=10000
MINT_QUOTE_RATE_LIMIT_CAPACITY=1
MINT_QUOTE_RATE_LIMIT_REFILL_PER_MINUTE=20
MINT_QUOTE_WS_RECONNECT_MS=180000
```

`MINT_QUOTE_ACTIVE_RETRY_MS`, `MINT_QUOTE_RECONCILIATION_RETRY_MS`, and
`MINT_QUOTE_RETRY_JITTER_RATIO` are deprecated and ignored by the runtime. They
are parsed temporarily so a Slice 3 deployment can be rolled back to the
previous monitor without changing its environment. They will be removed after
the production soak.

WebSocket recovery starts before immediate polling. Polling discovers normalized
mint queues in oldest-due order, checks cached NUT-29 capability, and only then
atomically claims rows for that mint. Different mint lanes run concurrently
under a global bound of 5,000 resident quotes. Capacity remains available for
discovered lanes that are still checking capabilities, and each lane drains
sequentially, so one slow request does not prevent responsive lanes from
claiming their next batch. An existing due
backlog is drained before the scheduler waits for the next interval. A batching
mint gets one request containing up to its advertised `max_batch_size` and the
remaining global capacity. Batch support comes from the persisted
mint-info cache and is refreshed after the cache's one-hour lifetime rather than
fetched during every polling turn.

Unsupported mints claim and individually check at most 10 quotes per turn. A
batch HTTP 400 or invalid response falls back to individual checks for only the
10 oldest quotes in that claim. Rate limiting, server errors, timeouts, aborts,
and transport failures do not trigger individual fallback. Every atomic claim
advances `last_polled_at`, even when its request fails. A reachable mint that
reports a missing quote is authoritative and expires the local quote.
All quote-monitor HTTP requests and WebSocket connection attempts pass through
an independent token bucket for each mint. `MINT_QUOTE_RATE_LIMIT_CAPACITY`
controls the maximum burst size and `MINT_QUOTE_RATE_LIMIT_REFILL_PER_MINUTE`
controls the continuous refill rate.
The safe defaults allow one immediate request followed by 20 requests per
minute. This applies to mint-info refreshes, NUT-29 batch chunks, and individual
fallback checks and WebSocket connection attempts without coupling traffic to
different mints.

Run only one application instance. The database is the source of truth for
quote state, while `mintQuote.created` and `mintQuote.stateChanged` are
best-effort, process-local events and are not delivered across instances.

### Fly.io and v2-to-v3 cutover

The checked-in `fly.toml` targets the `nightly-npubcash` app and its SQLite
volume. It is a staging or new-app configuration, not an in-place upgrade
configuration. Do not deploy it unchanged over an existing v2 installation.

Fly secrets are scoped to an app and their values cannot be copied out of Fly.
Before deploying v3, retrieve the target PostgreSQL URL from its original
secure source and set it explicitly on the app that will run v3:

```sh
fly secrets set --app "$V3_APP" DATABASE_URL="$V3_DATABASE_URL"
fly secrets list --app "$V3_APP"
fly deploy --app "$V3_APP"
```

Confirm that `DATABASE_URL` appears in the secret list before deploying. The
list shows secret names and digests, not their values. Keep the v2 app, its
secrets, and its PostgreSQL database unchanged until the v3 migration and
deployment have been verified. This preserves the option to direct traffic
back to v2 during rollback.

When migrating into a separate v3 database, set `DATABASE_URL` to the target
URL used by the migration command, not the v2 source URL. See the migration
instructions in the project README for the data-copy and verification steps.
