# LNURL Endpoint

npubcash-server acts as a LNURL / Lightning Address server. Therefore it implements
a LNURL Endpoint as per [LUD-16](https://github.com/lnurl/luds/blob/luds/16.md) and [NIP-57](https://github.com/nostr-protocol/nips/blob/master/57.md) to fetch invoices from.

```
https://<domain>/.well-known/lnurlp/<username>
```

and

```
<callback><?|&>amount=<milliSatoshi><?|&>nostr=<zapRequest>
```
