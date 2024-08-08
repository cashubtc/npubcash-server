import { Proof } from "@cashu/cashu-ts";
import {
  createBulkInsertQuery,
  createSanitizedValueString,
  queryWrapper,
} from "../utils/database";

export class Claim {
  id: number;
  user: string;
  mint_url: string;
  proof: Proof;
  status: "ready" | "inflight" | "spent";
  transaction_id?: number;

  constructor(
    id: number,
    user: string,
    mint_url: string,
    proof: Proof,
    status: "ready" | "inflight" | "spent",
    transaction_id?: number,
  ) {
    this.id = id;
    this.user = user;
    this.mint_url = mint_url;
    this.proof = proof;
    this.status = status;
    this.transaction_id = transaction_id;
  }

  static async createClaim(
    user: string,
    mint_url: string,
    proof: Proof,
    transaction_id: number,
  ) {
    const res = await queryWrapper(
      `INSERT INTO l_claims_3 ("user", mint_url, proof, status, transaction_id) VALUES ($1, $2, $3, $4, $5)`,
      [user, mint_url, JSON.stringify(proof), "ready", transaction_id],
    );
    if (res.rowCount === 0) {
      throw new Error("Failed to create new Transaction");
    }
  }

  static async updateClaimsStatus(ids: number[]) {
    if (ids.length === 0) {
      return;
    }
    const list = createSanitizedValueString(ids.length);
    const query = `UPDATE l_claims_3 SET status = 'spent' WHERE id in ${list}`;
    const res = await queryWrapper<Claim>(query, ids);
    return res;
  }

  static async getUserReadyClaimAmount(npub: string, username?: string) {
    const whereClause = username
      ? `WHERE ("user" = $1 OR "user" = $2) AND status = 'ready'`
      : `WHERE "user" = $1 AND status = 'ready'`;
    const query = `SELECT
    SUM((proof ->> 'amount')::INT) AS total_amount
    FROM
    l_claims_3
    ${whereClause};
    `;
    const res = await queryWrapper(query, username ? [npub, username] : [npub]);
    if (res.rows.length < 1 || !res.rows[0].total_amount) {
      return 0;
    }
    return res.rows[0].total_amount;
  }

  static async getPaginatedUserReadyClaims(
    page: number,
    npub: string,
    username?: string,
  ) {
    const offset = (page - 1) * 100;
    const whereClause = username
      ? `WHERE ("user" = $1 OR "user" = $2) AND status = 'ready'`
      : `WHERE "user" = $1 AND status = 'ready'`;
    const query = `
WITH total_count AS (
    SELECT COUNT(*) AS count
    FROM l_claims_3
    ${whereClause}
)
SELECT l_claims_3.*, total_count.count
FROM l_claims_3, total_count
${whereClause}
ORDER BY (proof->>'amount')::int DESC
LIMIT 100
OFFSET ${username ? "$3" : "$2"};
`;
    const res = await queryWrapper<Claim & { count: number }>(
      query,
      username ? [npub, username, offset] : [npub, offset],
    );
    if (res.rowCount === 0) {
      return { claims: [], count: 0 };
    }
    return {
      claims: res.rows.map(
        (row) =>
          new Claim(
            row.id,
            row.user,
            row.mint_url,
            row.proof,
            row.status,
            row.transaction_id,
          ),
      ),
      count: res.rows[0].count,
    };
  }

  static async getAllUserReadyClaims(npub: string, username?: string) {
    let allClaims: Claim[];
    if (username) {
      const userClaims = await Claim.getUserReadyClaims(username);
      const npubClaims = await Claim.getUserReadyClaims(npub);
      allClaims = [...userClaims, ...npubClaims];
    } else {
      allClaims = await Claim.getUserReadyClaims(npub);
    }
    return allClaims;
  }

  static async getUserReadyClaims(user: string) {
    const res = await queryWrapper<Claim>(
      `SELECT * FROM l_claims_3 WHERE "user" = $1 and status = $2`,
      [user, "ready"],
    );
    if (res.rowCount === 0) {
      return [];
    }
    return res.rows.map(
      (row) =>
        new Claim(
          row.id,
          row.user,
          row.mint_url,
          row.proof,
          row.status,
          row.transaction_id,
        ),
    );
  }

  static async getUserClaims(user: string) {
    const res = await queryWrapper<Claim>(
      `SELECT * FROM l_claims_3 WHERE "user" = $1`,
      [user],
    );
    if (res.rowCount === 0) {
      return [];
    }
    return res.rows.map(
      (row) =>
        new Claim(
          row.id,
          row.user,
          row.mint_url,
          row.proof,
          row.status,
          row.transaction_id,
        ),
    );
  }

  static async createClaims(
    user: string,
    mint_url: string,
    proofs: Proof[],
    transaction_id: number,
  ) {
    const nestedValues = proofs.map((proof) => [
      user,
      mint_url,
      proof,
      "ready",
      transaction_id,
    ]);
    const res = await createBulkInsertQuery(
      "l_claims_3",
      [`"user"`, "mint_url", "proof", "status", "transaction_id"],
      nestedValues,
    );
    if (res.rowCount === 0) {
      throw new Error("Failed to create new Claims...");
    }
  }

  static async getClaimsByIds(ids: number[]) {
    const list = createSanitizedValueString(ids.length);
    const query = `SELECT * FROM l_claims_3 WHERE id IN ${list};`;
    const res = await queryWrapper<Claim>(query, ids);
    if (res.rowCount === 0) {
      return [];
    }
    return res.rows.map(
      (row) =>
        new Claim(
          row.id,
          row.user,
          row.mint_url,
          row.proof,
          row.status,
          row.transaction_id,
        ),
    );
  }
}
