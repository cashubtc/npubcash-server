import { queryWrapper } from "../utils/database";

export class Transaction {
  id: string;
  mint_pr: string;
  mint_hash: string;
  server_pr: string;
  server_hash: string;
  created_at: number;

  constructor(
    mintPr: string,
    mintHash: string,
    serverPr: string,
    serverHash: string,
    createdAt: number,
  ) {
    this.mint_pr = mintPr;
    this.mint_hash = mintHash;
    this.server_pr = serverPr;
    this.server_hash = serverHash;
    this.created_at = createdAt;
  }

  static async createTransaction(
    mint_pr: string,
    mint_hash: string,
    server_pr: string,
    server_hash: string,
  ) {
    const res = await queryWrapper<Transaction>(
      `INSERT INTO l_transactions (mint_pr, mint_hash, server_pr, server_hash) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [mint_pr, mint_hash, server_pr, server_hash],
    );
    if (res.rowCount === 0) {
      throw new Error("Failed to create new Transaction");
    }
    return new Transaction(
      mint_pr,
      mint_hash,
      server_pr,
      server_hash,
      Math.floor(new Date(res.rows[0].created_at).getTime() / 1000),
    );
  }

  static async getTransactionByHash(paymentHash: string) {
    const res = await queryWrapper<Transaction>(
      `SELECT * from l_transactions WHERE server_hash = $1`,
      [paymentHash],
    );
    if (res.rowCount === 0) {
      throw new Error("Transaction not found in db");
    }
    return new Transaction(
      res.rows[0].mint_pr,
      res.rows[0].mint_hash,
      res.rows[0].server_pr,
      res.rows[0].server_hash,
      Math.floor(new Date(res.rows[0].created_at).getTime() / 1000),
    );
  }
}
