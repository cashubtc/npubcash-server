import { Request, Response } from "express";
import {
  CashuMint,
  CheckStateEnum,
  getEncodedToken,
} from "@cashu/cashu-ts";
import { Claim, User } from "../models";
import { WithdrawalStore } from "../models/withdrawal";
import { getProofStateYs } from "../utils/cashu";

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
  const proofYs = allClaims.claims.map((claim) =>
    getProofStateYs(claim.proof.secret),
  );
  const { states } = await new CashuMint(process.env.MINTURL!).check({
    Ys: proofYs.flatMap(({ current, legacy }) => [current, legacy]),
  });
  const spendableClaims = allClaims.claims.filter((_, index) => {
    const { current, legacy } = proofYs[index];
    return [current, legacy].every((proofY) => {
      const proofStates = states.filter(({ Y }) => Y === proofY);
      return (
        proofStates.length > 0 &&
        proofStates.every(({ state }) => state === CheckStateEnum.UNSPENT)
      );
    });
  });
  const spendableProofs = spendableClaims.map((claim) => claim.proof);
  if (spendableProofs.length === 0) {
    return res.json({ error: true, message: "No proofs to claim" });
  }
  try {
    await WithdrawalStore.getInstance()?.saveWithdrawal(
      spendableClaims,
      req.authData!.data.pubkey,
    );
    const token = getEncodedToken({
      memo: "",
      token: [{ mint: process.env.MINTURL!, proofs: spendableProofs }],
    });
    res.json({
      error: false,
      data: {
        token: token,
        count: spendableClaims.length,
        totalPending: allClaims.count,
      },
    });
  } catch (e) {
    console.warn(e);
    res.status(500);
    res.json({ error: true, message: "Something went wrong..." });
  }
}
