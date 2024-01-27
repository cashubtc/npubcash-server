import { NextFunction, Request, Response } from "express";
import { User } from "../models";

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
