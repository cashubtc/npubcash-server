import { queryWrapper } from "../utils/database";

export class Transaction {
  id: string;
  mint_pr: string;
  mint_hash: string;
  created_at: number;

  constructor(id: string, mintPr: string, mintHash: string, createdAt: number) {
    this.id = id;
    this.mint_pr = mintPr;
    this.mint_hash = mintHash;
    this.created_at = createdAt;
  }

  static async createTransaction(mint_pr: string, mint_hash: string) {
    const res = await queryWrapper<Transaction>(
      `INSERT INTO l_transactions (mint_pr, mint_hash) VALUES ($1, $2) RETURNING id, created_at`,
      [mint_pr, mint_hash],
    );
    if (res.rowCount === 0) {
      throw new Error("Failed to create new Transaction");
    }
    console.log(res);
    return new Transaction(
      res.rows[0].id,
      mint_pr,
      mint_hash,
      Math.floor(new Date(res.rows[0].created_at).getTime() / 1000),
    );
  }

  static async getTransactionFromDb(id: number) {
    const res = await queryWrapper<Transaction>(
      `SELECT * from l_transactions WHERE id = $1`,
      [String(id)],
    );
    if (res.rowCount === 0) {
      throw new Error("Transaction not found in db");
    }
    return new Transaction(
      res.rows[0].id,
      res.rows[0].mint_pr,
      res.rows[0].mint_hash,
      Math.floor(new Date(res.rows[0].created_at).getTime() / 1000),
    );
  }
}
