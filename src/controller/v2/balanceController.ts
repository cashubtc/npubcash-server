import { Request, Response } from "express";
import { Claim, User } from "../../models";

export async function getBalanceController(req: Request, res: Response) {
  const isAuth = req.authData!;
  try {
    const user = await User.getUserByPubkey(isAuth.data.pubkey);
    const balance = await Claim.getUserReadyClaimAmount(
      isAuth.data.npub,
      user?.name,
    );
    return res.json({ error: false, data: balance, unit: "sat" });
  } catch (e) {
    console.warn(e);
    res.status(500).json({ error: true, message: "Something went wrong..." });
  }
}
