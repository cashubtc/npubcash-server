import { Event } from "nostr-tools";
import { queryWrapper } from "../utils/database";

export class Transaction {
  id: number;
  mint_pr: string;
  mint_hash: string;
  server_pr: string;
  server_hash: string;
  user: string;
  created_at: number;
  zap_request?: Event;

  constructor(
    id: number,
    mintPr: string,
    mintHash: string,
    serverPr: string,
    serverHash: string,
    user: string,
    createdAt: number,
    zapRequest?: Event,
  ) {
    this.id = id;
    this.mint_pr = mintPr;
    this.mint_hash = mintHash;
    this.server_pr = serverPr;
    this.server_hash = serverHash;
    this.user = user;
    this.created_at = createdAt;
    this.zap_request = zapRequest;
  }

  static async createTransaction(
    mint_pr: string,
    mint_hash: string,
    server_pr: string,
    server_hash: string,
    user: string,
    zapRequest?: Event,
  ) {
    const res = await queryWrapper<Transaction>(
      `INSERT INTO l_transactions
(mint_pr, mint_hash, server_pr, server_hash, "user", zap_request)
VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [mint_pr, mint_hash, server_pr, server_hash, user, zapRequest],
    );
    if (res.rowCount === 0) {
      throw new Error("Failed to create new Transaction");
    }
    return new Transaction(
      res.rows[0].id,
      mint_pr,
      mint_hash,
      server_pr,
      server_hash,
      user,
      Math.floor(new Date(res.rows[0].created_at).getTime() / 1000),
      zapRequest,
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
      res.rows[0].id,
      res.rows[0].mint_pr,
      res.rows[0].mint_hash,
      res.rows[0].server_pr,
      res.rows[0].server_hash,
      res.rows[0].user,
      Math.floor(new Date(res.rows[0].created_at).getTime() / 1000),
      res.rows[0].zap_request,
    );
  }
}
