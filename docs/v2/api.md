# Endpoints

## Wallet

The WALLET endpoints provide the core functionality of npub.cash

### Quotes

`Protected`

```
GET /api/v2/wallet/quotes?since=[timestamp]&limit=[limit]&offset=[offset]
```

Returns the all `PAID` quotes that npub.cash has created and stored for the user. The response is paginated. Pagination can be controlled using the query parameters.
The `since` parameter can be used to instruct the server to only return quotes that have been paid since a certain timestamp. Wallets can use this parameter to reduce the amount of redundant data by setting it to the `paid_at`

The server does not check whether a quote was issue or spent and will keep returning these quotes. This avoids any state issues and a wallet could rebuild the complete state at any time. Therefore wallets are supposed to remember which quote_ids are already issued.

```json
{
  "error": false,
  "data": {
    "quotes": [
      {
        "created_at": 1748247091,
        "paid_at": 1748247121,
        "expires_at": 1748333491,
        "mint_url": "https://nofees.testnut.cashu.space",
        "quote_id": "4Bjp2lmEra1C1Pk-Mmic6KxQGlwmMSBaHaFLpWp_",
        "request": "lnbc20n1p5rgg3npp5h9zh88dg26dy746fumyusntqdvt0ayhahvceyhah86lnc2mzx7fqdqqcqzzsxqyz5vqsp5u588d2wm7vasghnvn0g3f636hv463uavenumzenw6t04zf6r0fuq9qxpqysgqqlye6jmcw4geum2067x8asewcxtvhqcd0s8xsmtpq9p0csp64ey50ce3hshqglhufqa5arxvr5qnw67aqvux6m550zeqcuccsnqqcfcqscuj5r",
        "amount": 2,
        "state": "PAID",
        "locked": false
      }
    ]
  },
  "metadata": {
    "total": 1,
    "limit": 50
  }
}
```

## User

The USER endpoints can be used to obtain and set user settings.

### Info

`Protected`

```

GET /api/v2/user/info

```

Returns the users settings:

```json
{
  "error": false,
  "data": {
    "user": {
      "pubkey": "96a0e855a1ce773b56aa4383c0277a9cdb2c68a4049425b3ed8622755d7f508f",
      "name": "myusername",
      "mint_url": "https://nofees.testnut.cashu.space",
      "lock_quote": false
    }
  }
}
```

### Set Username

`Protected`

```
POST /api/v2/user/username
```

This endpoint can be used to obtain a lightning address username if enabled by the provider. This endpoint expects a JSON payload:

```json
{ "username": "mynewusername" }
```

The price of a username is set by the provider. A payment request will be returned inside the `X-Cashu` header, following the Cashu 402 protocol

### Set Mint

`Protected`

```
PATCH /api/v2/user/mint
```

This endpoint can be used to set the user's preferred mint. Once set successfully npub.cash will use this mint to retrieve quotes for this user.

```json
{ "mint_url": "https://mymint.com" }
```

### Set Lock

`Protected`

```
PATCH /api/v2/user/lock
```

Using this endpoint users can opt-in into locking mint quotes to their public key. If set to `true` npub.cash will try to obtain locked quotes for each invoice. These quotes can not be redeemed without providing a valid signature for each one. Please make sure your client supports NUT-20 before proceeding.

```json
{ "lock_quotes": true }
```
