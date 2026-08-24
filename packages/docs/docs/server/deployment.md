# Deploying npubcash-server

The repository includes a multi-stage Docker image that builds the frontend and
runs the server with Bun. The container listens on port 8000 and supports either
SQLite or PostgreSQL.

## Prerequisites

- Docker
- A public hostname with TLS termination for an internet-facing deployment
- A Cashu mint URL used as the default for new recipients
- Persistent storage: a Docker volume for SQLite or an external PostgreSQL
  database

## Build the image

Clone the maintained `v3` branch and build from the repository root:

```bash
git clone --branch v3 https://github.com/cashubtc/npubcash-server.git
cd npubcash-server
docker build -t npubcash-server .
```

The Dockerfile does not use build arguments. Runtime configuration is supplied
through environment variables.

## Required configuration

Every production deployment needs:

| Variable | Description |
| --- | --- |
| `MINTURL` | Default Cashu mint URL for recipients without saved settings. |
| `JWT_SECRET` or `MNEMONIC` | Secret used to sign authentication JWTs. A mnemonic derives the secret when `JWT_SECRET` is omitted. |
| `DATABASE_URL` or `DATABASE_TYPE=sqlite` | PostgreSQL URL, SQLite file path, or an explicit request to use the production SQLite default. |

Use a long, random `JWT_SECRET`. If you use `MNEMONIC`, protect it as a wallet
seed and never commit it to the repository.

## SQLite deployment

With `NODE_ENV=production` and `DATABASE_TYPE=sqlite`, the server stores its
database at `/data/npubcash.db`. Mount `/data` on a persistent volume.

Create `.env`:

```dotenv
MINTURL=https://mint.example
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_TYPE=sqlite
ALLOWED_HOSTNAMES=npubcash.example
API_MODE=BOTH
LOG_LEVEL=info
```

Run the container:

```bash
docker volume create npubcash-data

docker run -d \
  --name npubcash-server \
  --restart unless-stopped \
  --env-file .env \
  -p 8000:8000 \
  -v npubcash-data:/data \
  npubcash-server
```

Do not run SQLite without a persistent `/data` mount; removing the container
would otherwise remove user settings and mint-quote history.

## PostgreSQL deployment

Set `DATABASE_URL` to a PostgreSQL connection string. Its scheme selects the
PostgreSQL adapter, so `DATABASE_TYPE` may be omitted.

```dotenv
MINTURL=https://mint.example
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_URL=postgresql://user:password@db-host:5432/npubcash?sslmode=require
ALLOWED_HOSTNAMES=npubcash.example
API_MODE=BOTH
LOG_LEVEL=info
```

```bash
docker run -d \
  --name npubcash-server \
  --restart unless-stopped \
  --env-file .env \
  -p 8000:8000 \
  npubcash-server
```

The server runs database migrations before it begins listening. A migration
failure stops startup rather than serving against a partial schema.

## Reverse proxy and public URLs

Terminate TLS at a reverse proxy such as Caddy, Nginx, or Traefik and forward
HTTP and WebSocket traffic to container port 8000. Preserve the `Host` header
and set `X-Forwarded-Proto: https`.

Set `ALLOWED_HOSTNAMES` to a comma-separated list of public hostnames, without
schemes, ports, paths, or wildcards:

```dotenv
ALLOWED_HOSTNAMES=npubcash.example,www.npubcash.example
```

The server uses the public host and forwarded protocol when validating NIP-98,
constructing LNURL callbacks, and constructing WebSocket challenges. Incorrect
proxy headers will therefore break authentication or produce invalid callbacks.

## Optional features

| Variable | Default | Description |
| --- | --- | --- |
| `API_MODE` | `BOTH` | `BOTH` serves the bundled frontend; `API_ONLY` serves only API routes. |
| `PORT` | `8000` | Internal HTTP/WebSocket listening port. Keep the Docker mapping consistent if changed. |
| `LOG_LEVEL` | `info` | `info` or `debug`. |
| `LNURL_MIN_AMOUNT` | `1000` | Minimum LNURL amount in millisatoshis. |
| `LNURL_MAX_AMOUNT` | `100000000` | Maximum LNURL amount in millisatoshis. |
| `USERNAME_MINT` | Disabled | Mint used to receive paid username registrations. |
| `USERNAME_COST` | Disabled | Username price in satoshis; zero enables free registration. Both username variables are required to enable the feature. |

### Nostr zaps

To enable zap-request handling, set `NOSTR_ENABLED` to a non-empty value and
provide both relay configuration and a signing key:

```dotenv
NOSTR_ENABLED=true
DEFAULT_RELAYS=wss://relay.damus.io,wss://relay.primal.net
ZAP_SECRET_KEY=replace-with-a-32-byte-hex-private-key
```

`MNEMONIC` may be used instead of `ZAP_SECRET_KEY`. To disable Nostr support,
omit `NOSTR_ENABLED` entirely. Do not set it to `false`: the current server
treats any non-empty value as enabled.

### Quote-monitor tuning

Most deployments should keep the defaults. Operators who need to tune mint
traffic can set:

- `MINT_QUOTE_ACTIVE_POLL_MS`
- `MINT_QUOTE_REQUEST_TIMEOUT_MS`
- `MINT_QUOTE_RATE_LIMIT_CAPACITY`
- `MINT_QUOTE_RATE_LIMIT_REFILL_PER_MINUTE`
- `MINT_QUOTE_WS_RECONNECT_MS`

The server validates these as positive values during startup.

## Upgrade the container

Pull the desired revision, rebuild, and replace the container while preserving
the database or SQLite volume:

```bash
git pull --ff-only
docker build -t npubcash-server .
docker stop npubcash-server
docker rm npubcash-server

docker run -d \
  --name npubcash-server \
  --restart unless-stopped \
  --env-file .env \
  -p 8000:8000 \
  -v npubcash-data:/data \
  npubcash-server
```

Back up the database before an upgrade. PostgreSQL deployments should omit the
SQLite volume flag and continue using the same `DATABASE_URL`.
