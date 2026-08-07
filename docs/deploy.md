# Deploy npub.cash

## Prerequisites

In order to deploy npub.cash yourself you will need:

- A PostgreSQL database, or a persistent volume if you explicitly choose SQLite
- A Blink API account

## Deploy npubcash-server

Deploying npubcash-server is easy. There are two ways to deploy the app:

### Docker

npub.cash ships with a dockerfile. Clone the repository, build the image and deploy it.

```sh
git clone -b migrations --recurse-submodules https://github.com/cashubtc/npubcash-server.git

cd npubcash-server

docker build -t npc-server .
```

Once deployed make sure to set your environment variables accordingly (see below)

### Manually

You can also build the application code yourself and deploy it Manually

```sh
git clone -b migrations --recurse-submodules https://github.com/cashubtc/npubcash-server.git

cd npubcash-server

npm ci

npm run build
```

Once deployed, start the server package in production mode. The root-level
`start` script is for development and must not be used for a production deploy:

```sh
cd packages/server
NODE_ENV=production bun run start
```

Make sure to set your environment variables accordingly (see below).

### Env variables

npubcash-server needs a couple of environment variables to run.

```sh
# PostgreSQL (DATABASE_TYPE is inferred)
DATABASE_URL=postgres://user:password@host/database
# Or explicitly opt in to SQLite. DATABASE_URL may be omitted to use the
# production default, /data/npubcash.db, on a persistent volume.
# DATABASE_TYPE=sqlite
# The url of the default mint
MINTURL=
# You Blink API settings
BLINK_API_KEY=
BLINK_WALLET_ID=
BLINK_URL=
# The nostr private key used by the NIP-57 provider
ZAP_SECRET_KEY=
# LNURL settings
LNURL_MIN_AMOUNT=
LNURL_MAX_AMOUNT=
# Optional comma-separated allowlist. Values are hostnames without schemes,
# ports, paths, or wildcards. When unset, request hostnames are not restricted.
ALLOWED_HOSTNAMES=npub.cash
```

Public URLs are derived from each request's `Host` and `X-Forwarded-Proto`
headers. The reverse proxy must preserve the public host and set
`X-Forwarded-Proto` to `http` or `https`. Set `ALLOWED_HOSTNAMES` in production
unless the ingress already rejects unexpected hosts.

Production startup fails when both `DATABASE_URL` and `DATABASE_TYPE` are
missing. This prevents a missing PostgreSQL secret from silently starting the
server on an empty SQLite database. If both variables are set, their database
types must agree.

### Mint quote monitoring

Unpaid quotes remain recoverable after invoice expiry until the mint returns an
authoritative quote state. Retry deadlines are stored in the database, so a
restart does not immediately retry every unavailable mint.

The defaults can be tuned with the following values:

```env
MINT_QUOTE_ACTIVE_POLL_MS=20000
MINT_QUOTE_ACTIVE_RETRY_MS=5000,10000,30000,60000
MINT_QUOTE_RECONCILIATION_RETRY_MS=60000,300000,1800000,7200000,21600000
MINT_QUOTE_RETRY_JITTER_RATIO=0.2
MINT_QUOTE_REQUEST_TIMEOUT_MS=10000
MINT_QUOTE_RATE_LIMIT_CAPACITY=1
MINT_QUOTE_RATE_LIMIT_REFILL_PER_MINUTE=25
MINT_QUOTE_WS_RECONNECT_MS=180000
```

Active retry and reconciliation retry values are comma-separated schedules;
the final value is reused as the cap. A reachable mint that reports a missing
quote is treated as authoritative and the local quote is marked expired.
At startup, all due unpaid quotes are staged without timers or WebSocket
subscriptions and grouped by mint. Mints advertising NUT-29 support for
`bolt11` are checked through the batch endpoint, split by the advertised
`max_batch_size` when present. Terminal results are persisted before WebSocket
subscriptions are created for surviving active quotes. Unsupported or invalid
batch responses activate the individual-check fallback, while mint-wide
failures retain the normal circuit backoff. Startup reconciliation runs
independently per mint, so a slow mint does not delay subscriptions for others.
All quote-monitor HTTP requests pass through an independent token bucket for
each mint. `MINT_QUOTE_RATE_LIMIT_CAPACITY` controls the maximum burst size and
`MINT_QUOTE_RATE_LIMIT_REFILL_PER_MINUTE` controls the continuous refill rate.
The safe defaults allow one immediate request followed by 25 requests per
minute. This applies to mint-info discovery, NUT-29 batch chunks, and individual
fallback checks without coupling traffic to different mints.
Run only one quote-monitoring server instance unless a database lease is added.

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

## Setup Blink

Right now there is no way for a mint to let you know once an invoice has been paid (until websockets are merged soon(tm)).
Therefore npubcash-server uses Blink as a wrapper. You need to configure your Blink API credentials in your environment and then add your servers webhook url to Blink.
Open the Blink Callback [Dashboard](https://dashboard.blink.sv/callback) and add your webhook url. It will be `https://<your hostname>/api/v1/paid`

## Setup locally

It is possible to quickly setup npubcash-server locally for development using the `compose.yaml` file.
However as the service relies on Blinks webhook integration, you will need to have the machine running the server reachable publicly and add its IP to the Blink dashboard
