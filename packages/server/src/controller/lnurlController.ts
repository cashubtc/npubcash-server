import { mintComm } from "@/config";
import { BadRequestError } from "@/errors";
import { MintQuote } from "@/models/mint";
import {
  createLnurlResponse,
  extractUserdataFromUserParam,
  isValidAmount,
} from "@/utils/lnurl";
import { getRequestLogger } from "@/utils/logger";
import { decodeAndValidateZapRequest } from "@/utils/nostr";
import { unixToDate } from "@/utils/time";
import { NextFunction, Request, Response } from "express";
import { Event } from "nostr-tools";
import { AppConfig } from "@/config/index";
import { handleSubscription } from "@/poller";

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
    handleSubscription(sub, mintQuote, logger);
    res.json({
      pr: request,
      routes: [],
    });
  } catch (e) {
    next(e);
  }
}
