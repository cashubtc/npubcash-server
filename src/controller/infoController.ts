import { NextFunction, Request, Response } from "express";
import { User } from "../models";
import { JwtPayload, sign, verify } from "jsonwebtoken";
import { lnProvider } from "..";
import { PaymentJWTPayload } from "../types";

export async function getInfoController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
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
  if (!req.authData || !req.authData.authorized) {
    res.status(402);
    return next(new Error("Unauthorized!"));
  }
  const { username, paymentToken } = req.body;
  if (!username) {
    res.status(400);
    return next(new Error("Missing parameters"));
  }
  if (!paymentToken) {
    const { paymentRequest } = await lnProvider.createInvoice(5);
    const token = sign(
      { pubkey: req.authData.data.pubkey, username, paymentRequest },
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
  const { paid } = await lnProvider.checkPayment(payload.paymentRequest);
  if (!paid) {
    return res.status(402).json({ error: true, message: "Invoice unpaid..." });
  }
  res.json({ error: false });
}
