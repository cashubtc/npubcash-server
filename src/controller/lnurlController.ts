import { mintComm } from "@/config";
import { BadRequestError, InternalError, NotFoundError } from "@/errors";
import { User } from "@/models";
import { MintQuote } from "@/models/mint";
import { createLnurlResponse } from "@/utils/lnurl";
import {
  createZapReceipt,
  decodeAndValidateZapRequest,
  extractZapRequestData,
  publishZapReceipt,
} from "@/utils/nostr";
import { unixToDate } from "@/utils/time";
import { NextFunction, Request, Response } from "express";
import { Event, nip19 } from "nostr-tools";

export async function lnurlController(
  req: Request<
    { user: string },
    unknown,
    unknown,
    { amount?: string; nostr?: string }
  >,
  res: Response,
  next: NextFunction,
) {
  try {
    const { amount, nostr } = req.query;
    const userParam = req.params.user;
    let zapRequest: Event | undefined;

    const userdata = await extractUserdataFromUserParam(userParam);

    if (!amount) {
      const lnurlResponse = createLnurlResponse(userdata.username);
      return res.json(lnurlResponse);
    }
    const parsedAmount = parseInt(amount);
    if (!isValidAmount(parsedAmount)) {
      throw new BadRequestError("Invalid amount");
    }
    const roundedMintAmount = Math.floor(parsedAmount / 1000);

    if (nostr) {
      try {
        zapRequest = decodeAndValidateZapRequest(nostr, amount);
      } catch (e) {
        throw new BadRequestError("Invalid zap request");
      }
    }
    const { expiry, quote, request } = await mintComm.getMintQuote(
      Math.floor(parsedAmount / 1000),
    );
    const mintQuote = await MintQuote.createNewMintQuoteInDb(
      quote,
      unixToDate(expiry),
      request,
      userdata.mintUrl,
      roundedMintAmount,
      userdata.pubkey,
    );

    const start = performance.now();
    const sub = mintComm.pollForMintQuote(quote);
    sub.on("polling", () => {
      console.log("Polling for mint quote update: ", quote);
      const now = performance.now();
      console.log(`Polling after ${Math.floor((now - start) / 1000)} seconds`);
    });
    sub.on("paid", () => {
      console.log("Mint quote got paid: ", mintQuote);
      mintQuote.setStateAndUpdateDb("PAID");
      if (zapRequest) {
        handleZapRequest(quote, zapRequest, request);
      }
    });
    sub.on("issued", () => {
      console.log("Mint quote got issued: ", mintQuote);
      mintQuote.setStateAndUpdateDb("ISSUED");
      sub.cancel();
    });
    sub.on("expired", () => {
      mintQuote.setStateAndUpdateDb("EXPIRED");
      sub.cancel();
    });
    res.json({
      pr: request,
      routes: [],
    });
  } catch (e) {
    next(e);
  }
}

async function handleZapRequest(
  mintQuote: string,
  zapEvent: Event,
  invoice: string,
) {
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
  console.log(
    `Finished Zap Publishing for ${mintQuote}. Successes: ${pubRes.success}, failures: ${pubRes.failed}`,
  );
}

async function extractUserdataFromUserParam(userParam: string): Promise<{
  username: string;
  pubkey: string;
  isNpub: boolean;
  mintUrl: string;
}> {
  if (userParam.startsWith("npub")) {
    const decoded = nip19.decode(userParam as `npub1${string}`);
    return {
      username: userParam,
      pubkey: decoded.data,
      isNpub: true,
      mintUrl: process.env.MINTURL!,
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

function isValidAmount(amount: number) {
  return (
    amount <= Number(process.env.LNURL_MAX_AMOUNT) &&
    amount >= Number(process.env.LNURL_MIN_AMOUNT) &&
    Number.isInteger(amount)
  );
}
