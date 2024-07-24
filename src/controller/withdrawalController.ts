import { Request, Response } from "express";
import { Withdrawal, WithdrawalStore } from "../models/withdrawal";
import { Claim } from "../models";
import { queryWrapper } from "../utils/database";

export async function getLatestWithdrawalsController(
  req: Request,
  res: Response,
) {
  const authData = req.authData!;
  try {
    const withdrawals =
      await WithdrawalStore.getInstance()?.getLastWithdrawlsByPubkey(
        authData.data.pubkey,
      );
    res.status(200).json({ error: false, data: { withdrawals } });
  } catch (e) {
    console.warn("Failed to get latest withdrawals:");
    console.log(e);
    res.status(500).json({ error: true, message: "Something went wrong" });
  }
}

export async function getWithdrawalDetailsController(
  req: Request,
  res: Response,
) {
  const authData = req.authData!;
  const withdrawlId = req.params.id;
  try {
    const query = `
SELECT
    l_withdrawals.*,
    l_claims_3.*
FROM
    l_withdrawals
JOIN
    LATERAL UNNEST(l_withdrawals.claim_ids) AS claim_id ON true
JOIN
    l_claims_3 ON l_claims_3.id = claim_id
WHERE
    l_withdrawals.id = $1
AND
    l_withdrawals.pubkey = $2;`;
    const queryRes = await queryWrapper<Claim & Withdrawal>(query, [
      withdrawlId,
      authData.data.pubkey,
    ]);
    if (queryRes.rowCount === 0) {
      res.status(404).json({ error: true, message: "not found" });
    }
    res.status(200).json({
      error: false,
      data: {
        amount: queryRes.rows[0].amount,
        proofs: queryRes.rows.map((r) => r.proof),
      },
    });
  } catch (e) {
    console.warn("Failed to get withdrawal details");
    console.log(e);
    res.status(500).json({ error: true, message: "Something went wrong" });
  }
}
