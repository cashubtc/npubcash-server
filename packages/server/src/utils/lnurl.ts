import { config } from "../config/index";

export function createLnurlResponse(username: string) {
  if (config.nostr.nostrEnabled) {
    return {
      callback: `${config.hostname}/.well-known/lnurlp/${username}`,
      maxSendable: config.lnurlLimits.max,
      minSendable: config.lnurlLimits.min,
      metadata: JSON.stringify([
        ["text/plain", "A cashu lightning address... Neat!"],
      ]),
      tag: "payRequest",
      allowsNostr: true,
      nostrPubkey: config.nostr.zapKeys.publicKey,
    };
  } else {
    return {
      callback: `${config.hostname}/.well-known/lnurlp/${username}`,
      maxSendable: config.lnurlLimits.max,
      minSendable: config.lnurlLimits.min,
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
