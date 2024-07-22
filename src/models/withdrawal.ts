import { createSanitizedValueString, getDbClient } from "../utils/database";
import { Claim } from "./claim";

export class Withdrawal {
  claims: Claim[];
  pubkey: string;

  constructor(claims: Claim[], pubkey: string) {
    this.claims = claims;
    this.pubkey = pubkey;
  }

  get amount() {
    return this.claims.reduce((a, c) => a + c.proof.amount, 0);
  }

  async addToDb() {
    const client = await getDbClient();
    try {
      await client.query("BEGIN");
      const ids = this.claims.map((c) => c.id);
      const withDrawalInsertQuery = `INSERT INTO l_withdrawals (amount, pubkey, claimIds) VALUES ($1, $2, $3)`;
      await client.query(withDrawalInsertQuery, [
        this.amount,
        this.pubkey,
        ids,
      ]);
      const list = createSanitizedValueString(ids.length);
      const claimUpdateQuery = `UPDATE l_claims_3 SET status = 'spent' WHERE id in ${list}`;
      await client.query(claimUpdateQuery, ids);
    } catch (e) {
      console.warn("Failed to create withdrawl... rolling back");
      client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
