import { queryWrapper } from "../utils/database";

export class Claim {
  user: string;
  token: string;
  claimed: boolean;

  constructor(user: string, token: string, claimed: boolean) {
    this.user = user;
    this.token = token;
    this.claimed = claimed;
  }

  static async createClaim(user: string, token: string) {
    const res = await queryWrapper(
      `INSERT INTO l_claims ("user", token, claimed) VALUES ($1, $2, false)`,
      [user, token],
    );
    if (res.rowCount === 0) {
      throw new Error("Failed to create new Transaction");
    }
  }

  static async getUserClaims(user: string) {
    const res = await queryWrapper<Claim>(
      `SELECT * FROM l_claims WHERE user = $1`,
      [user],
    );
    if (res.rowCount === 0) {
      throw new Error("No Claims found in db");
    }
    return res.rows.map((row) => new Claim(row.user, row.token, row.claimed));
  }
}
