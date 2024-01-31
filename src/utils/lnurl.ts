export function createLnurlResponse(username: string) {
  if (process.env.ZAP_PUBKEY) {
    return {
      callback: `https://cashu-address.com/.well-known/lnurlp/${username}`,
      maxSendable: 250000,
      minSendable: 10000,
      metadata: JSON.stringify([
        ["text/plain", "A cashu lightning address... Neat!"],
      ]),
      tag: "payRequest",
      allowsNostr: true,
      nostrPubkey: process.env.ZAP_PUBKEY,
    };
  } else {
    return {
      callback: `https://cashu-address.com/.well-known/lnurlp/${username}`,
      maxSendable: 250000,
      minSendable: 10000,
      metadata: JSON.stringify([
        ["text/plain", "A cashu lightning address... Neat!"],
      ]),
      tag: "payRequest",
    };
  }
}
