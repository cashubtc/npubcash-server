import {
  BadRequestError,
  PaymentRequiredError,
  UsernameTakenError,
} from "@/errors";
import { NextFunction, Request, Response } from "express";
import {
  CashuMint,
  CashuWallet,
  Proof,
  Token,
  getDecodedToken,
} from "@cashu/cashu-ts";
import { usernameRegex } from "@/constants/regex";
import { User } from "@/models";

//TODO: Replace with env vars
const mintUrl = "https://nofees.testnut.cashu.space";
const amount = 21;

export async function usernameController(
  req: Request<unknown, unknown, { username: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const authData = req.authData!;
    const { username } = req.body;
    if (!username) {
      throw new BadRequestError("Missing parameters: username");
    }
    const parsedUsername = validateAndParseUsername(username);
    const isUsernameTaken = await User.checkIfUsernameExists(parsedUsername);
    if (isUsernameTaken) {
      throw new UsernameTakenError();
    }

    const xCashu = req.header("X-Cashu");
    if (!xCashu) {
      throw new PaymentRequiredError(amount, mintUrl);
    }
    const receivedProofs = await validateAndReceivePayment(
      xCashu,
      amount,
      mintUrl,
    );
    console.log(receivedProofs);
    User.upsertUsernameByPubkey(authData.data.pubkey, parsedUsername);
    res.status(201).json({ error: false });
  } catch (e) {
    next(e);
  }
}

function validateAndParseUsername(username: string) {
  const parsedUsername = username.toLowerCase().trim();
  if (!parsedUsername.match(usernameRegex) || parsedUsername.length < 3) {
    throw new BadRequestError("Invalid username!");
  }
  return parsedUsername;
}

async function validateAndReceivePayment(
  tokenString: string,
  requiredAmount: number,
  requiredMint: string,
  tipsAllowed = true,
): Promise<Proof[]> {
  function throwPaymentError(reason: string): never {
    throw new PaymentRequiredError(
      amount,
      mintUrl,
      "Invalid payment: " + reason,
    );
  }
  let decodedToken: Token | undefined;
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
  try {
    const testWallet = new CashuWallet(new CashuMint(mintUrl));
    const proofs = await testWallet.receive(decodedToken);
    //TODO: Do something with new proofs
    return proofs;
  } catch (e) {
    throwPaymentError("invalid token / already spent");
  }
}
