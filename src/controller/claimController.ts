import { Request, Response } from "express";
import { CashuMint, Proof, getEncodedToken } from "@cashu/cashu-ts";
import { Claim, User } from "../models";

export async function balanceController(req: Request, res: Response) {
  const isAuth = req.authData!;
  const user = await User.getUserByPubkey(isAuth.data.pubkey);
  let allClaims: Claim[];
  if (user) {
    const userClaims = await Claim.getUserReadyClaims(user.name);
    const npubClaims = await Claim.getUserReadyClaims(isAuth.data.npub);
    allClaims = [...userClaims, ...npubClaims];
  } else {
    const npubClaims = await Claim.getUserReadyClaims(isAuth.data.npub);
    allClaims = npubClaims;
  }
  const proofs = allClaims.map((claim) => claim.proof);
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
  let allClaims: Claim[];
  if (user) {
    const userClaims = await Claim.getUserReadyClaims(user.name);
    const npubClaims = await Claim.getUserReadyClaims(req.authData!.data.npub);
    allClaims = [...userClaims, ...npubClaims];
  } else {
    allClaims = await Claim.getUserReadyClaims(req.authData!.data.npub);
  }
  const proofs = allClaims.map((claim) => claim.proof);
  const payload = { proofs: proofs.map((p) => ({ secret: p.secret })) };
  const { spendable } = await new CashuMint(process.env.MINTURL!).check(
    payload,
  );
  const spendableProofs = proofs.filter((_, i) => spendable[i]);
  const token = getEncodedToken({
    memo: "",
    token: [{ mint: process.env.MINTURL!, proofs: spendableProofs }],
  });
  if (spendableProofs.length === 0) {
    return res.json({ error: true, message: "No proofs to claim" });
  }
  res.json({ error: false, data: { token: token } });
}
