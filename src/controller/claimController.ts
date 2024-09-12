import { Request, Response } from "express";
import { CashuMint, getEncodedToken } from "@cashu/cashu-ts";
import { Claim, User } from "../models";
import { WithdrawalStore } from "../models/withdrawal";
import { wallet } from "../config";

export async function balanceController(req: Request, res: Response) {
  const isAuth = req.authData!;
  try {
    const user = await User.getUserByPubkey(isAuth.data.pubkey);
    const balance = await Claim.getUserReadyClaimAmount(
      isAuth.data.npub,
      user?.name,
    );
    return res.json({ error: false, data: balance });
  } catch (e) {
    console.warn(e);
    res.status(500).json({ error: true, message: "Something went wrong..." });
  }
}

export async function claimGetController(req: Request, res: Response) {
  const user = await User.getUserByPubkey(req.authData!.data.pubkey);
  const allClaims = await Claim.getPaginatedUserReadyClaims(
    1,
    req.authData!.data.npub,
    user?.name,
  );
  if (allClaims.count === 0) {
    return res.json({ error: true, message: "No proofs to claim" });
  }
  const proofs = allClaims.claims.map((claim) => claim.proof);
  const stateCheck = await wallet.checkProofsSpent(proofs);
  const spentSecrets = stateCheck.map((r) => r.secret);
  const spendableProofs = proofs.filter(
    (p) => !spentSecrets.includes(p.secret),
  );
  try {
    await WithdrawalStore.getInstance()?.saveWithdrawal(
      allClaims.claims,
      req.authData!.data.pubkey,
    );
    const token = getEncodedToken({
      memo: "",
      token: [{ mint: process.env.MINTURL!, proofs: spendableProofs }],
    });
    if (spendableProofs.length === 0) {
      return res.json({ error: true, message: "No proofs to claim" });
    }
    res.json({
      error: false,
      data: {
        token: token,
        count: allClaims.claims.length,
        totalPending: allClaims.count,
      },
    });
  } catch (e) {
    console.warn(e);
    res.status(500);
    res.json({ error: true, message: "Something went wrong..." });
  }
}
