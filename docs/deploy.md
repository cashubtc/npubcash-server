# Deploy npub.cash

## Prerequisites

In order to deploy npub.cash yourself you will need:

- A postgres database to connect to
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

Once deployed you can start the service using `npm run start`. Make sure to set your environment variables accordingly (see below)

### Env variables

npubcash-server needs a couple of environment variables to run.

```sh
#Your database connection settings
PGUSER=
PGPASSWORD=
PGHOST=
PGDATABASE=
PGPORT=
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
# The hostname your app will be reached under
HOSTNAME=
```

## Setup Blink

Right now there is no way for a mint to let you know once an invoice has been paid (until websockets are merged soon(tm)).
Therefore npubcash-server uses Blink as a wrapper. You need to configure your Blink API credentials in your environment and then add your servers webhook url to Blink.
Open the Blink Callback [Dashboard](https://dashboard.blink.sv/callback) and add your webhook url. It will be `https://<your hostname>/api/v1/paid`

## Setup locally

It is possible to quickly setup npubcash-server locally for development using the `compose.yaml` file.
However as the service relies on Blinks webhook integration, you will need to have the machine running the server reachable publicly and add its IP to the Blink dashboard
