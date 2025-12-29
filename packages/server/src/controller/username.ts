import {
  BadRequestError,
  PaymentRequiredError,
  UsernameTakenError,
} from "@/errors";
import { NextFunction, Request, Response } from "express";
import { Token, getDecodedToken } from "@cashu/cashu-ts";
import { communicatorService, proofService, userService } from "@/config";
import { AppConfig } from "../config/index";
import { SetUsernamePayload } from "npubcash-types";

const config = AppConfig.getInstance();

export async function usernameController(
  req: Request<unknown, unknown, SetUsernamePayload>,
  res: Response,
  next: NextFunction,
) {
  try {
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

    const xCashu = req.header("X-Cashu");
    if (!xCashu) {
      throw new PaymentRequiredError(amount, mintUrl);
    }
    const decodedToken = await validatePayment(xCashu, amount, mintUrl);
    const newProofs = await communicatorService.redeemToken(decodedToken);
    await proofService.saveProofs(newProofs);
    const user = await userService.setUsername(
      authData.data.pubkey,
      parsedUsername,
    );

    res.status(201).json({ error: false, data: { user } });
  } catch (e) {
    next(e);
  }
}

async function validatePayment(
  tokenString: string,
  requiredAmount: number,
  requiredMint: string,
  tipsAllowed = true,
): Promise<Token> {
  function throwPaymentError(reason: string): never {
    throw new PaymentRequiredError(
      requiredAmount,
      requiredMint,
      "Invalid payment: " + reason,
    );
  }
  let decodedToken: Token;
  try {
    decodedToken = getDecodedToken(tokenString);
  } catch (e) {
    return throwPaymentError("invalid token");
  }
  if (decodedToken.mint !== requiredMint) {
    return throwPaymentError("wrong mint");
  }
  const paidAmount = decodedToken.proofs.reduce((a, c) => a + c.amount, 0);
  if (tipsAllowed) {
    if (paidAmount < requiredAmount) {
      return throwPaymentError("wrong amount");
    }
  } else {
    if (paidAmount !== requiredAmount) {
      return throwPaymentError("wrong amount");
    }
  }
  return decodedToken;
}
