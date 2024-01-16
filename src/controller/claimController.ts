import { NextFunction, Request, Response } from "express";
import { verifyAuth } from "../utils/auth";
import { User } from "../models/user";
import { Claim } from "../models/claim";

export async function claimController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    res.status(401);
    return next(new Error("Unauthorized"));
  }
  const isAuth = await verifyAuth(
    authHeader,
    "http://localhost:8000/claim",
    "GET",
  );
  if (!isAuth.authorized) {
    res.status(401);
    return next(new Error("Unauthorized"));
  }
  const user = await User.getUserByPubkey(isAuth.data.pubkey);
  if (user) {
    console.log("is user");
    const userClaims = await Claim.getUserClaims(user.name);
    const npubClaims = await Claim.getUserClaims(isAuth.data.npub);
    return res.json({ error: false, data: [...userClaims, ...npubClaims] });
  } else {
    const npubClaims = await Claim.getUserClaims(isAuth.data.npub);
    return res.json({ error: false, data: npubClaims });
  }
}
