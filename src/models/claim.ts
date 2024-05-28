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
}
