import { Event, validateEvent } from "nostr-tools";
import { ZapRequestData } from "../types";

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
    if (tags[i][0] === "p") {
      zapRequestData.pTags.push(tags[i][1]);
    }
  }
  return zapRequestData;
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
  console.log(z);
  console.log(lnurlAmount);
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
