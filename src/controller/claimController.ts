import { NextFunction, Request, Response } from "express";
import { verifyAuth } from "../utils/auth";
import { User } from "../models/user";
import { Claim } from "../models/claim";
import { TokenEntry, getDecodedToken } from "@cashu/cashu-ts";

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
    "https://cashu.my2sats.space/claim",
    "GET",
  );
  if (!isAuth.authorized) {
    res.status(401);
    return next(new Error("Unauthorized"));
  }
  const user = await User.getUserByPubkey(isAuth.data.pubkey);
  let allClaims: Claim[];
  if (user) {
    const userClaims = await Claim.getUserClaims(user.name);
    const npubClaims = await Claim.getUserClaims(isAuth.data.npub);
    allClaims = [...userClaims, ...npubClaims];
  } else {
    const npubClaims = await Claim.getUserClaims(isAuth.data.npub);
    allClaims = npubClaims;
  }
  const decodedToken = allClaims.map((claim) => getDecodedToken(claim.token));
  const entries = [] as TokenEntry[];
  decodedToken.forEach((token) => {
    token.token.forEach((entry) => {
      entries.push(entry);
    });
  });
  const balance = entries.reduce((a, c) => {
    let val = 0;
    c.proofs.forEach((proof) => {
      val = val + proof.amount;
    });
    return a + val;
  }, 0);
  return res.json({ error: false, data: balance });
}

export async function claimPostController(
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
    "https://cashu.my2sats.space/claim",
    "POST",
    req.body,
  );
  if (!isAuth.authorized) {
    res.status(401);
    return next(new Error("Invalid Authorization Header"));
  }
}
