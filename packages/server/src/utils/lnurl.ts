import { AppConfig } from "../config/index";

const config = AppConfig.getInstance();

export function createLnurlResponse(username: string) {
  if (config.nostr.nostrEnabled) {
    return {
      callback: `${process.env.HOSTNAME}/.well-known/lnurlp/${username}`,
      maxSendable: Number(process.env.LNURL_MAX_AMOUNT),
      minSendable: Number(process.env.LNURL_MIN_AMOUNT),
      metadata: JSON.stringify([
        ["text/plain", "A cashu lightning address... Neat!"],
      ]),
      tag: "payRequest",
      allowsNostr: true,
      nostrPubkey: config.nostr.zapKeys.publicKey,
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

export function isValidAmount(amount: number) {
  return (
    amount <= config.lnurlLimits.max &&
    amount >= config.lnurlLimits.min &&
    Number.isInteger(amount)
  );
}
