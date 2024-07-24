import { Request, Response } from "express";
import { CashuMint, Proof, getEncodedToken } from "@cashu/cashu-ts";
import { Claim, User } from "../models";
import { Withdrawal, WithdrawalStore } from "../models/withdrawal";

export async function balanceController(req: Request, res: Response) {
  const isAuth = req.authData!;
  const user = await User.getUserByPubkey(isAuth.data.pubkey);
  let allClaims = await Claim.getAllUserReadyClaims(
    req.authData!.data.npub,
    user?.name,
  );
  const proofs = allClaims.map((claim) => claim.proof);
  if (allClaims.length === 0) {
    return res.json({ error: false, data: 0 });
  }
  const payload = {
    proofs: proofs.map((p) => ({ secret: p.secret })),
  };
  const { spendable } = await new CashuMint(process.env.MINTURL!).check(
    payload,
  );
  const spendableProofs: Proof[] = [];
  const unspendableClaims: Claim[] = [];
  for (let i = 0; i < proofs.length; i++) {
    if (spendable[i]) {
      spendableProofs.push(proofs[i]);
    } else {
      unspendableClaims.push(allClaims[i]);
    }
  }
  Claim.updateClaimsStatus(unspendableClaims.map((claim) => claim.id));
  const balance = spendableProofs.reduce((a, c) => a + c.amount, 0);
  return res.json({ error: false, data: balance });
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
  const payload = { proofs: proofs.map((p) => ({ secret: p.secret })) };
  const { spendable } = await new CashuMint(process.env.MINTURL!).check(
    payload,
  );
  const spendableProofs = proofs.filter((_, i) => spendable[i]);
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
    res.json({ error: false, data: { token: token, count: allClaims.count } });
  } catch (e) {
    console.warn(e);
    res.status(500);
    res.json({ error: true, message: "Something went wrong..." });
  }
}
