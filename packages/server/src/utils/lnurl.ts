import { NotFoundError } from "@/errors";
import { AppConfig } from "../config/index";
import { User } from "@/models";
import { nip19 } from "nostr-tools";

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

export async function extractUserdataFromUserParam(userParam: string): Promise<{
  username: string;
  pubkey: string;
  isNpub: boolean;
  mintUrl: string;
}> {
  if (userParam.startsWith("npub")) {
    const decoded = nip19.decode(userParam as `npub1${string}`);
    const userObj = await User.getUserByPubkey(decoded.data);
    return {
      username: userParam,
      pubkey: decoded.data,
      isNpub: true,
      mintUrl: userObj?.mint_url || process.env.MINTURL!,
    };
  } else {
    const userObj = await User.getUserByName(userParam.toLowerCase());
    if (!userObj) {
      throw new NotFoundError("User not found.");
    }
    return {
      username: userObj.name,
      pubkey: userObj.pubkey,
      isNpub: false,
      mintUrl: userObj.mint_url,
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
