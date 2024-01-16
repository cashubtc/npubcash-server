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
  if (!user) {
    res.status(404);
    return next(new Error("User not found"));
  }
  const claims = await Claim.getUserClaims(user.name);
  res.json({ error: false, data: claims });
}
