import { NextFunction, Request, Response } from "express";
import { User } from "../models";
import jwt from "jsonwebtoken";
import { lnProvider } from "../config";
import { PaymentJWTPayload } from "../types";
import { usernameRegex } from "../constants/regex";

const { sign, verify } = jwt;

export async function getInfoController(req: Request, res: Response) {
  try {
    const username = await User.getUserByPubkey(req.authData?.data.pubkey!);
    res.json({
      username: username ? username.name : null,
      npub: req.authData?.data.npub!,
      mintUrl: username ? username.mint_url : process.env.MINTURL!,
    });
  } catch (e) {
    console.warn("info controller: Failed to get info ");
    console.log(e);
    res.status(500);
    res.json({ error: true, message: "internal errror" });
  }
}

export async function putMintInfoController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { mintUrl } = req.body;
  try {
    new URL(mintUrl);
  } catch {
    res.status(400);
    return next(new Error("Invalid URL"));
  }
  if (!mintUrl) {
    res.status(400);
    return next(new Error("Missing parameters"));
  }
  try {
    await User.upsertMintByPubkey(req.authData?.data.pubkey!, mintUrl);
  } catch (e) {
    console.log(e);
    res.status(500);
    return next(new Error("Failed to update DB"));
  }
  res.status(204).send();
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
