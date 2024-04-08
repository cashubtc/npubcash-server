import { NextFunction, Request, Response } from "express";
import { Claim, User } from "../models";
import { sign, verify } from "jsonwebtoken";
import { lnProvider } from "..";
import { PaymentJWTPayload } from "../types";
import { usernameRegex } from "../constants/regex";
import { isValidMint } from "../utils/mint";

export async function getInfoController(req: Request, res: Response) {
  const username = await User.getUserByPubkey(req.authData?.data.pubkey!);
  res.json({
    username: username ? username.name : null,
    npub: req.authData?.data.npub!,
    mintUrl: username ? username.mint_url : process.env.MINTURL!,
  });
}

export async function putMintInfoController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authData = req.authData!;
  const { mintUrl } = req.body;
  if (!mintUrl) {
    res.status(400);
    return res.json({ error: true, message: "missing parameters" });
  }
  const userObj = await User.getUserByPubkey(authData.data.pubkey);
  const activeClaims = await Claim.getAllUserReadyClaims(
    authData.data.pubkey,
    userObj?.name,
  );
  if (activeClaims.length > 0) {
    res.status(400);
    return res.json({
      error: true,
      message: "can not change mint with balance. Please claim balance first",
    });
  }
  const isValid = await isValidMint(mintUrl);
  if (!isValid) {
    res.status(400);
    return res.json({ error: true, message: "invalid mint url" });
  }
  try {
    await User.upsertMintByPubkey(req.authData?.data.pubkey!, mintUrl);
  } catch (e) {
    console.log(e);
    res.status(500);
    return next(new Error("Failed to update DB"));
  }
  res.json({ error: false, data: { mintUrl } });
}

export async function putUsernameInfoController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { username, paymentToken } = req.body;
  if (!username) {
    res.status(400);
    return res.json({ error: true, message: "Missing parameters" });
  }
  const parsedUsername = username.toLowerCase().trim();
  if (!parsedUsername.match(usernameRegex) || parsedUsername.length < 3) {
    res.status(400);
    return res.json({ error: true, message: "Invalid username" });
  }
  const user = await User.getUserByPubkey(req.authData!.data.pubkey!);
  if (user && user.name) {
    res.status(400);
    return res.json({ error: true, message: "Username already set" });
  }
  const usernameExists = await User.checkIfUsernameExists(parsedUsername);
  if (usernameExists) {
    res.status(400);
    return res.json({ error: true, message: "This username is already taken" });
  }
  if (!paymentToken) {
    const { paymentRequest } = await lnProvider.createInvoice(5000);
    const token = sign(
      {
        pubkey: req.authData!.data.pubkey,
        username: parsedUsername,
        paymentRequest,
      },
      process.env.JWT_SECRET!,
    );
    return res.status(402).json({
      error: true,
      message: "Payment required",
      data: { paymentToken: token, paymentRequest },
    });
  }
  const payload = verify(
    paymentToken,
    process.env.JWT_SECRET!,
  ) as PaymentJWTPayload;
  if (payload.pubkey !== req.authData!.data.pubkey) {
    res.status(403);
    res.json({ error: true, message: "Forbidden!" });
  }
  const { paid } = await lnProvider.checkPayment(payload.paymentRequest);
  if (!paid) {
    return res.status(402).json({ error: true, message: "Invoice unpaid..." });
  }
  try {
    await User.upsertUsernameByPubkey(
      req.authData!.data.pubkey,
      parsedUsername,
    );
  } catch (e) {
    console.log(e);
    res.status(500);
    return next(new Error("Failed to update db"));
  }
  res.json({ error: false });
}
