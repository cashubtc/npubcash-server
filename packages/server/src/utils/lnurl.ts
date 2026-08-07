import { config } from "../config/index";

export function createLnurlResponse(username: string, publicOrigin: string) {
  const callback = new URL(
    `/.well-known/lnurlp/${username}`,
    publicOrigin,
  ).toString();
  if (config.nostr.nostrEnabled) {
    return {
      callback,
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
      callback,
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
