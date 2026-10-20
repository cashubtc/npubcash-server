import {
  BadRequestError,
  PaymentRequiredError,
  UsernameTakenError,
} from "@/errors";
import { NextFunction, Request, Response } from "express";
import { getTokenMetadata, type TokenMetadata } from "@cashu/cashu-ts";
import {
  getCommunicatorService,
  getProofService,
  getUserService,
} from "@/config";
import { config } from "../config/index";
import type { SetUsernamePayload } from "@npubcash/api-contract";

export async function usernameController(
  req: Request<unknown, unknown, SetUsernamePayload>,
  res: Response,
  next: NextFunction,
) {
  try {
    const communicatorService = getCommunicatorService();
    const proofService = getProofService();
    const userService = getUserService();
    if (!config.usernameConfig.enabled) {
      throw new BadRequestError(
        "Usernames can not be purchased on this instance",
      );
    }
    const { amount, mintUrl } = config.usernameConfig;

    const authData = req.authData!;
    const { username } = req.body;
    if (!username) {
      throw new BadRequestError("Missing parameters: username");
    }
    const parsedUsername = userService.validateAndParseUsername(username);
    const isUsernameTaken = await userService.usernameExists(username);
    if (isUsernameTaken) {
      throw new UsernameTakenError();
    }

    if (amount !== 0) {
      const xCashu = req.header("X-Cashu");
      if (!xCashu) {
        throw new PaymentRequiredError(amount, mintUrl);
      }
      const token = validatePayment(xCashu, amount, mintUrl);
      const newProofs = await communicatorService.redeemToken(token);
      await proofService.saveProofs(newProofs);
    }
    const user = await userService.setUsername(
      authData.data.pubkey,
      parsedUsername,
    );

    res.status(201).json({ error: false, data: { user } });
  } catch (e) {
    next(e);
  }
}

function validatePayment(
  tokenString: string,
  requiredAmount: number,
  requiredMint: string,
  tipsAllowed = true,
): string {
  function throwPaymentError(reason: string): never {
    throw new PaymentRequiredError(
      requiredAmount,
      requiredMint,
      "Invalid payment: " + reason,
    );
  }
  // cashu-ts v3 only needs the mint's keyset ids to decode short (V4) keyset ids;
  // the wallet that redeems the token resolves them, so validate on metadata here.
  let tokenMetadata: TokenMetadata;
  try {
    tokenMetadata = getTokenMetadata(tokenString);
  } catch (e) {
    return throwPaymentError("invalid token");
  }
  if (tokenMetadata.mint !== requiredMint) {
    return throwPaymentError("wrong mint");
  }
  const paidAmount = tokenMetadata.amount;
  if (tipsAllowed) {
    if (paidAmount < requiredAmount) {
      return throwPaymentError("wrong amount");
    }
  } else {
    if (paidAmount !== requiredAmount) {
      return throwPaymentError("wrong amount");
    }
  }
  return tokenString;
}
