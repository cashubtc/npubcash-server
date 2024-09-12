import { Request, Response } from "express";
import { Claim, User } from "../../models";
import { WithdrawalStore } from "../../models/withdrawal";
import { wallet } from "../../config";

export async function GetClaimsController(req: Request, res: Response) {
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
  if (spendableProofs.length === 0) {
    return res.json({ error: true, message: "No proofs to claim" });
  }
  try {
    await WithdrawalStore.getInstance()?.saveWithdrawal(
      allClaims.claims,
      req.authData!.data.pubkey,
    );
    res.json({
      error: false,
      data: {
        mint: process.env.MINTURL!,
        proofs: spendableProofs,
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
