import { Proof } from "@cashu/cashu-ts";
import { queryWrapper } from "../utils/database";

export class Claim {
  id: number;
  user: string;
  mint_url: string;
  proofs: Proof[];
  status: "ready" | "inflight" | "spent";

  constructor(
    id: number,
    user: string,
    mint_url: string,
    proofs: Proof[],
    status: "ready" | "inflight" | "spent",
  ) {
    this.id = id;
    this.user = user;
    this.mint_url = mint_url;
    this.proofs = proofs;
    this.status = status;
  }

  static async createClaim(user: string, mint_url: string, proofs: Proof[]) {
    const res = await queryWrapper(
      `INSERT INTO l_claims_2 ("user", mint_url, proofs, status) VALUES ($1, $2, $3, "ready")`,
      [user, mint_url, proofs],
    );
    if (res.rowCount === 0) {
      throw new Error("Failed to create new Transaction");
    }
  }

  static async getUserClaims(user: string) {
    const res = await queryWrapper<Claim>(
      `SELECT * FROM l_claims WHERE "user" = $1`,
      [user],
    );
    if (res.rowCount === 0) {
      return [];
    }
    return res.rows.map(
      (row) =>
        new Claim(row.id, row.user, row.mint_url, row.proofs, row.status),
    );
  }
}
