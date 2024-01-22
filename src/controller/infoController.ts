import { NextFunction, Request, Response } from "express";
import { verifyAuth } from "../utils/auth";
import { User } from "../models/user";

export async function getInfoController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    res.status(401);
    return next(new Error("Missing Authorization Header"));
  }
  const isAuth = await verifyAuth(
    authHeader,
    `${process.env.HOSTNAME}/api/v1/info`,
    "GET",
  );
  if (!isAuth.authorized) {
    res.status(401);
    return next(new Error("Invalid Authorization Header"));
  }
  const username = await User.getUserByPubkey(isAuth.data.pubkey);
  res.json({
    username: username ? username : null,
    npub: isAuth.data.npub,
    mintUrl: process.env.MINTURL!,
  });
}
