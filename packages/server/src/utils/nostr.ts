import {
  Event,
  EventTemplate,
  VerifiedEvent,
  finalizeEvent,
  validateEvent,
} from "nostr-tools";
import { wrapEvent } from "nostr-tools/nip17";
import { ZapRequestData } from "../types";
import { nostrPool } from "../config";
import { config } from "../config/index";
import { Logger } from "winston";
import { decodeZapRequestParameter } from "./zapRequest";

export function getTagValues(e: Event, tag: string, position: number) {
  const tags = e.tags;
  const values: string[] = [];
  for (let i = 0; i < tags.length; i++) {
    if (tags[i][0] === tag) {
      values.push(tags[i][position]);
    }
  }
  return values;
}

export function extractZapRequestData(e: Event) {
  const zapRequestData: ZapRequestData = {
    pTags: [],
    aTags: [],
    eTags: [],
    relays: [],
  };
  const tags = e.tags;
  for (let i = 0; i < tags.length; i++) {
    if (tags[i][0] === "amount") {
      zapRequestData.amount = Number(tags[i][1]);
    }
    if (tags[i][0] === "relays") {
      zapRequestData.relays = tags[i].slice(1);
    }
    if (tags[i][0] === "e") {
      zapRequestData.eTags.push(tags[i][1]);
    }
    if (tags[i][0] === "a") {
      zapRequestData.aTags.push(tags[i][1]);
    }
    if (tags[i][0] === "p") {
      zapRequestData.pTags.push(tags[i][1]);
    }
  }
  return zapRequestData;
}

export function createZapReceipt(
  paidAt: number,
  pTag: string,
  eTag: string | undefined,
  aTag: string | undefined,
  invoice: string,
  zapRequest: Event,
) {
  const sk = config.nostr.zapKeys.secretKey;
  const serialisedZapRequest = JSON.stringify(zapRequest);
  const event: EventTemplate = {
    content: "",
    kind: 9735,
    created_at: paidAt,
    tags: [
      ["p", pTag],
      ["P", zapRequest.pubkey],
      ["bolt11", invoice],
      ["description", serialisedZapRequest],
    ],
  };
  if (eTag) {
    event.tags.push(["e", eTag]);
  }
  if (aTag) {
    event.tags.push(["a", aTag]);
  }
  return finalizeEvent(event, sk);
}

export function decodeAndValidateZapRequest(
  encodedZapRequest: string,
  lnurlAmount: string,
) {
  const decodedEvent = decodeZapRequestParameter(encodedZapRequest);
  validateEvent(decodedEvent);
  const zapRequestData = extractZapRequestData(decodedEvent);
  const isValidData = isValidZapRequestData(
    zapRequestData,
    Number(lnurlAmount),
  );
  if (!isValidData) {
    throw new Error("Invalid Zap Request Data");
  }
  return decodedEvent;
}

export function isValidZapRequestData(z: ZapRequestData, lnurlAmount: number) {
  if (z.pTags.length === 0 || z.pTags.length > 1 || z.eTags.length > 1) {
    return false;
  }
  if (z.amount) {
    if (z.amount !== lnurlAmount) {
      return false;
    }
  }
  return true;
}

const createTimeoutPromise = (ms: number) => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Timeout exceeded")), ms);
  });
};

export async function publishZapReceipt(
  receiptEvent: VerifiedEvent,
  requestRelays?: string[],
) {
  const defaultRelays = config.nostr.defaultRelays;
  const pubPromises = nostrPool.publish(
    requestRelays || defaultRelays,
    receiptEvent,
  );
  const wrappedPromises = pubPromises.map((promise) =>
    Promise.race([promise, createTimeoutPromise(3000)]),
  );
  return Promise.allSettled(wrappedPromises);
}

export async function publishOtp(
  recipientPubkey: string,
  otp: string,
  preferredRelay?: string,
) {
  if (!config.nostr.nostrEnabled) {
    throw new Error("Nostr is not enabled");
  }
  const wrap = wrapEvent(
    config.nostr.zapKeys.secretKey,
    { publicKey: recipientPubkey },
    `Your npub.cash OTP: ${otp}`,
  );
  const pubPromises = nostrPool.publish(
    preferredRelay ? [preferredRelay] : config.nostr.defaultRelays,
    wrap,
  );
  return Promise.allSettled(
    pubPromises.map((p) => Promise.race([p, createTimeoutPromise(3000)])),
  );
}

export async function handleZapRequest(
  mintQuote: string,
  zapEvent: Event,
  invoice: string,
  logger?: Logger,
) {
  logger?.debug("Handling Zap Request");
  const zapRequestData = extractZapRequestData(zapEvent);
  const zapReceipt = createZapReceipt(
    Math.floor(Date.now() / 1000),
    zapRequestData.pTags[0],
    zapRequestData.eTags[0],
    zapRequestData.aTags[0],
    invoice,
    zapEvent,
  );
  const pubs = await publishZapReceipt(zapReceipt);
  const pubRes = pubs.reduce(
    (a, c) => {
      if (c.status === "fulfilled") {
        a.success++;
      } else {
        a.failed++;
      }
      return a;
    },
    { failed: 0, success: 0 },
  );
  logger?.debug(
    `Finished Zap Publishing for ${mintQuote}. Successes: ${pubRes.success}, failures: ${pubRes.failed}`,
  );
}
