import { config } from "../config/index";

export function createLnurlResponse(username: string, publicOrigin: string) {
  const origin = new URL(publicOrigin);
  const callback = new URL(
    `/.well-known/lnurlp/${username}`,
    origin,
  ).toString();
  const metadata = JSON.stringify([
    ["text/plain", "A cashu lightning address... Neat!"],
    ["text/identifier", `${username.toLowerCase()}@${origin.host}`],
  ]);
  if (config.nostr.nostrEnabled) {
    return {
      callback,
      maxSendable: config.lnurlLimits.max,
      minSendable: config.lnurlLimits.min,
      metadata,
      tag: "payRequest",
      allowsNostr: true,
      nostrPubkey: config.nostr.zapKeys.publicKey,
    };
  } else {
    return {
      callback,
      maxSendable: config.lnurlLimits.max,
      minSendable: config.lnurlLimits.min,
      metadata,
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
