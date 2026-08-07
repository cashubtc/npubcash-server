import {
  getCommunicatorService,
  getMintQuoteRepository,
  getUserService,
} from "@/config";
import { BadRequestError } from "@/errors";
import { createLnurlResponse, isValidAmount } from "@/utils/lnurl";
import { getRequestLogger } from "@/utils/logger";
import { decodeAndValidateZapRequest } from "@/utils/nostr";
import { unixToDate } from "@/utils/time";
import { NextFunction, Request, Response } from "express";
import { Event } from "nostr-tools";
import { config } from "@/config/index";
import { getPublicRequestUrl } from "@/utils/publicRequest";

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
    const communicatorService = getCommunicatorService();
    const mintQuoteRepository = getMintQuoteRepository();
    const userService = getUserService();
    const logger = getRequestLogger(req);
    const { amount, nostr } = req.query;
    const userParam = req.params.user;
    let zapRequest: Event | undefined;

    const userdata = await userService.extractUserdataFromUserParam(userParam);

    if (!amount) {
      logger.debug("Returning LNURL Reponse for " + userdata.username);
      const publicOrigin = getPublicRequestUrl(
        req,
        config.allowedHostnames,
      ).origin;
      const lnurlResponse = createLnurlResponse(
        userdata.username,
        publicOrigin,
      );
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
    const { expiry, quote, request, locked } =
      await communicatorService.createMintQuote(
        Math.floor(parsedAmount / 1000),
        userdata,
        userdata.mintUrl,
      );
    const mintQuote = await mintQuoteRepository.create({
      unit: "sat",
      quoteId: quote,
      expiresAt: unixToDate(expiry),
      paymentRequest: request,
      mintUrl: userdata.mintUrl,
      amount: roundedMintAmount,
      pubkey: userdata.pubkey,
      serializedZapRequest: nostr,
      locked,
    });

    await communicatorService.createQuoteSubscription(mintQuote, logger);

    res.json({
      pr: request,
      routes: [],
    });
  } catch (e) {
    next(e);
  }
}
