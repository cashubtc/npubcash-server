import {
  Event,
  EventTemplate,
  VerifiedEvent,
  finalizeEvent,
  validateEvent,
} from "nostr-tools";
import { ZapRequestData } from "../types";
import { nostrPool } from "../config";

const relays = [
  "wss://relay.current.fyi",
  "wss://nostr-pub.wellorder.net",
  "wss://relay.damus.io",
  "wss://nostr.zebedee.cloud",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://nostr.mom",
];

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
  const event: EventTemplate = {
    content: "",
    kind: 9735,
    created_at: paidAt,
    tags: [
      ["p", pTag],
      ["P", zapRequest.pubkey],
      ["bolt11", invoice],
      ["description", JSON.stringify(zapRequest)],
    ],
  };
  if (eTag) {
    event.tags.push(["e", eTag]);
  }
  if (aTag) {
    event.tags.push(["a", aTag]);
  }
  return finalizeEvent(event, Buffer.from(process.env.ZAP_SECRET_KEY!, "hex"));
}

export function decodeAndValidateZapRequest(
  encodedZapRequest: string,
  lnurlAmount: string,
) {
  const decodedEvent = JSON.parse(decodeURI(encodedZapRequest)) as Event;
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

export function decodeZapRequestParameter(r: string) {
  return JSON.parse(decodeURI(r)) as Event;
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
  const pubPromises = nostrPool.publish(requestRelays || relays, receiptEvent);
  const wrappedPromises = pubPromises.map((promise) =>
    Promise.race([promise, createTimeoutPromise(3000)]),
  );
  return Promise.allSettled(wrappedPromises);
}
