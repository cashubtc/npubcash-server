# Deploying npubcash-server <Badge type="warning" text="npubcash v2" />

This guide walks through building and running your own `npubcash-server` with Docker. You will need access to a PostgreSQL database and a public hostname (if deploying on the internet).

## Prerequisites

- Docker installed on the target host
- A reachable PostgreSQL instance and connection URL
- A public hostname and TLS termination (via reverse proxy) for production deployments

## Step-by-step deployment (Docker)

1. Clone the repository and check out the v2 branch

```sh
git clone https://github.com/cashubtc/npubcash-server.git
cd npubcash-server
git checkout v2
```

2. Build the Docker image

Set the public hostname you will serve from as a build argument.

```sh
docker build . -t npubcash-server --build-arg HOSTNAME=https://npubx.cash
```

3. Create an `.env` file

Required:

- MNEMONIC: A BIP39 mnemonic used to derive required secrets
- DATABASE_URL: Full PostgreSQL connection URL

Optional:

- NOSTR_ENABLED: Set to `true` to allow zap requests
- DEFAULT_RELAYS: Required if NOSTR_ENABLED is `true`. Comma-separated list of default relays for zap receipts when none are provided in a request
- USERNAME_MINT: Mint URL required for Cashu‑402 username purchases (must be set to enable username purchases)
- USERNAME_COST: Amount in sats that usernames are sold for (must be set to enable username purchases)
- API_MODE: Enable the built-in frontend. Either `BOTH` or `API_ONLY`
- LOG_LEVEL: Log level for the internal stdout logger
- LNURL_MAX_AMOUNT: Max amount in msat allowed by the LNURL endpoint
- LNURL_MIN_AMOUNT: Min amount in msat allowed by the LNURL endpoint

Example `.env`:

```text
# Required
MNEMONIC="replace with your 12/24-word mnemonic"
DATABASE_URL="postgresql://user:password@db-host:5432/npubcash?sslmode=disable"

# Optional
NOSTR_ENABLED=false
DEFAULT_RELAYS="wss://relay.damus.io,wss://relay.primal.net"
USERNAME_MINT="https://mint.example"
USERNAME_COST=1000
API_MODE=BOTH
LOG_LEVEL=info
LNURL_MAX_AMOUNT=1000000
LNURL_MIN_AMOUNT=1000
```

4. Run the container

Map the application port and load the env file. Adjust the port mapping to match the port your image exposes.

```sh
docker run -d \
  --name npubcash-server \
  --restart unless-stopped \
  --env-file ./.env \
  -p 3000:3000 \
  npubcash-server
```

If you are running behind a reverse proxy (Caddy, Nginx, Traefik), terminate TLS at the proxy and forward traffic to the container port from above.

## Notes

- Keep your `MNEMONIC` secret and never commit `.env` to version control.
- If `NOSTR_ENABLED=true`, set `DEFAULT_RELAYS` to a non-empty, comma-separated list.
- `USERNAME_MINT` and `USERNAME_COST` must both be set to enable username purchases.
- LNURL amounts are in millisatoshis (msat).

## Upgrading

To upgrade, rebuild the image and recreate the container:

```sh
docker build . -t npubcash-server --build-arg HOSTNAME=https://npubx.cash
docker rm -f npubcash-server
docker run -d --name npubcash-server --restart unless-stopped --env-file ./.env -p 3000:3000 npubcash-server
```
