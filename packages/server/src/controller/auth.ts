import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { RawAuthToken } from "../types";

function generateAuthJwt(
  pubkey: string,
  userAgent: string,
  level: "otp" | "nip98",
  canWithdraw?: boolean,
) {
  const hashedAgent = createHash("sha256").update(userAgent).digest("hex");
  const payload: RawAuthToken = { p: pubkey, u: hashedAgent, l: level };
  if (canWithdraw) {
    payload.w = canWithdraw;
  }
  const token = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: 60 * 30,
  });
  return token;
}

export async function getNip98AuthController(req: Request, res: Response) {
  const authData = req.authData!;
  const userAgent = req.get("user-agent");
  const canWithdraw = req.query.canWithdraw === "true";
  if (!userAgent) {
    res.status(400);
    return res.json({ error: true, status: "Bad request" });
  }
  const jwt = generateAuthJwt(
    authData.data.pubkey,
    userAgent,
    "nip98",
    canWithdraw,
  );
  res.json({ error: false, data: { token: jwt } });
}
