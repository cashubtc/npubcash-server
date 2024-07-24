import { Pool } from "pg";
import { createSanitizedValueString } from "../utils/database";
import { Claim } from "./claim";

export class Withdrawal {
  id: number;
  claim_ids: number[];
  created_at: number;
  pubkey: string;
  amount: number;

  constructor(
    id: number,
    claim_ids: number[],
    pubkey: string,
    amount: number,
    created_at: number,
  ) {
    this.id = id;
    this.claim_ids = claim_ids;
    this.pubkey = pubkey;
    this.amount = amount;
    this.created_at = created_at;
  }
}

export class WithdrawalStore {
  private pool: Pool;
  static instance: WithdrawalStore;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  static getInstance(pool?: Pool) {
    if (this.instance) {
      return this.instance;
    } else {
      if (pool) {
        this.instance = new WithdrawalStore(pool);
        return this.instance;
      } else {
        throw new Error("Not instantiated yet...");
      }
    }
  }

  async getLastWithdrawlsByPubkey(pubkey: string) {
    const res = await this.pool.query<Withdrawal & { count: number }>(
      `
WITH total_count AS (
  SELECT COUNT(*)::integer AS count
  FROM l_withdrawals
  WHERE pubkey = $1
)
SELECT l_withdrawals.*, total_count.count
FROM l_withdrawals, total_count 
WHERE pubkey = $1
ORDER BY created_at DESC
LIMIT 50;
`,
      [pubkey],
    );
    if (res.rowCount === 0) {
      return { withdrawals: [], count: 0 };
    }
    return {
      withdrawals: res.rows.map(
        (row) =>
          new Withdrawal(
            row.id,
            row.claim_ids,
            row.pubkey,
            row.amount,
            Math.floor(new Date(row.created_at).getTime() / 1000),
          ),
      ),
      count: res.rows[0].count,
    };
  }

  async saveWithdrawal(claims: Claim[], pubkey: string) {
    const client = await this.pool.connect();
    let amount = 0;
    let ids: number[] = [];
    for (let i = 0; i < claims.length; i++) {
      amount += claims[i].proof.amount;
      ids.push(claims[i].id);
    }
    try {
      await client.query("BEGIN");
      const ids = claims.map((c) => c.id);
      const withDrawalInsertQuery = `INSERT INTO l_withdrawals (amount, pubkey, claim_ids) VALUES ($1, $2, $3)`;
      const res1 = await client.query(withDrawalInsertQuery, [
        amount,
        pubkey,
        ids,
      ]);
      console.log(res1);
      const list = createSanitizedValueString(ids.length);
      const claimUpdateQuery = `UPDATE l_claims_3 SET status = 'spent' WHERE id in ${list}`;
      const res2 = await client.query(claimUpdateQuery, ids);
      console.log(res2);
      await client.query("COMMIT");
    } catch (e) {
      console.warn("Failed to create withdrawl... rolling back");
      client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
