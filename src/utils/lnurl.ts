import { ZAP_PUBKEY } from "../config";

export function createLnurlResponse(username: string) {
  if (process.env.ZAP_SECRET_KEY) {
    return {
      callback: `${process.env.HOSTNAME}/.well-known/lnurlp/${username}`,
      maxSendable: Number(process.env.LNURL_MAX_AMOUNT),
      minSendable: Number(process.env.LNURL_MIN_AMOUNT),
      metadata: JSON.stringify([
        ["text/plain", "A cashu lightning address... Neat!"],
      ]),
      tag: "payRequest",
      allowsNostr: true,
      nostrPubkey: ZAP_PUBKEY,
    };
  } else {
    return {
      callback: `${process.env.HOSTNAME}/.well-known/lnurlp/${username}`,
      maxSendable: Number(process.env.LNURL_MAX_AMOUNT),
      minSendable: Number(process.env.LNURL_MIN_AMOUNT),
      metadata: JSON.stringify([
        ["text/plain", "A cashu lightning address... Neat!"],
      ]),
      tag: "payRequest",
    };
  }
}
