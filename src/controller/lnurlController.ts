import { mintComm } from "@/config";
import { BadRequestError, NotFoundError } from "@/errors";
import { User } from "@/models";
import { MintQuote } from "@/models/mint";
import { createLnurlResponse } from "@/utils/lnurl";
import { getRequestLogger } from "@/utils/logger";
import {
  createZapReceipt,
  decodeAndValidateZapRequest,
  extractZapRequestData,
  publishZapReceipt,
} from "@/utils/nostr";
import { unixToDate } from "@/utils/time";
import { NextFunction, Request, Response } from "express";
import { Event, nip19 } from "nostr-tools";
import { Logger } from "winston";
import { AppConfig } from "@/config/index";

const config = AppConfig.getInstance();

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
    const logger = getRequestLogger(req);
    const { amount, nostr } = req.query;
    const userParam = req.params.user;
    let zapRequest: Event | undefined;

    const userdata = await extractUserdataFromUserParam(userParam);

    if (!amount) {
      logger.debug("Returning LNURL Reponse for " + userdata.username);
      const lnurlResponse = createLnurlResponse(userdata.username);
      return res.json(lnurlResponse);
    }
    const parsedAmount = parseInt(amount);
    if (!isValidAmount(parsedAmount)) {
      throw new BadRequestError("Invalid amount");
    }
    const roundedMintAmount = Math.floor(parsedAmount / 1000);

    if (nostr && config.nostr.nostrEnabled) {
      try {
        zapRequest = decodeAndValidateZapRequest(nostr, amount);
      } catch (e) {
        throw new BadRequestError("Invalid zap request");
      }
    }
    const { expiry, quote, request } = await mintComm.getMintQuote(
      Math.floor(parsedAmount / 1000),
    );
    const mintQuote = await MintQuote.createNewMintQuoteInDb({
      unit: "sat",
      quote_id: quote,
      expires_at: unixToDate(expiry),
      payment_request: request,
      mint_url: userdata.mintUrl,
      amount: roundedMintAmount,
      pubkey: userdata.pubkey,
    });

    const sub = mintComm.pollForMintQuote(quote);
    sub.on("polling", () => {
      logger.debug("Polling for mint quote update: ", quote);
    });
    sub.on("paid", () => {
      logger.debug("Mint quote got paid", mintQuote);
      mintQuote.setPaid();
      if (zapRequest && config.nostr.nostrEnabled) {
        handleZapRequest(quote, zapRequest, request);
      }
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

async function extractUserdataFromUserParam(userParam: string): Promise<{
  username: string;
  pubkey: string;
  isNpub: boolean;
  mintUrl: string;
}> {
  if (userParam.startsWith("npub")) {
    //TODO: Check whether user has a profile first
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
    amount <= config.lnurlLimits.max &&
    amount >= config.lnurlLimits.min &&
    Number.isInteger(amount)
  );
}
