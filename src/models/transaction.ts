import { Event } from "nostr-tools";
import { queryWrapper } from "../utils/database";
import { FailedPayment } from "../types";

export class Transaction {
  id: number;
  mint_pr: string;
  mint_hash: string;
  server_pr: string;
  server_hash: string;
  cashu_quote_id: string;
  user: string;
  created_at: number;
  zap_request: Event | undefined;
  fulfilled: boolean;
  amount: number;

  constructor(
    id: number,
    mintPr: string,
    mintHash: string,
    serverPr: string,
    serverHash: string,
    cashuQuoteId: string,
    user: string,
    createdAt: number,
    zapRequest: Event | undefined,
    fulfilled: boolean,
    amount: number,
  ) {
    this.id = id;
    this.mint_pr = mintPr;
    this.mint_hash = mintHash;
    this.server_pr = serverPr;
    this.server_hash = serverHash;
    this.cashu_quote_id = cashuQuoteId;
    this.user = user;
    this.created_at = createdAt;
    this.zap_request = zapRequest;
    this.fulfilled = fulfilled;
    this.amount = amount;
  }

  async recordFailedPayment() {
    const res = await queryWrapper<FailedPayment>(
      `INSERT INTO l_failed_payments (server_pr, mint_pr, quote, "user", amount, transaction_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        this.server_pr,
        this.mint_pr,
        this.cashu_quote_id,
        this.user,
        this.amount,
        this.id,
      ],
    );
    if (res.rowCount === 0) {
      console.error("Failed to record failed payment!!");
    }
  }

  static async setToFulfilled(id: number) {
    const res = await queryWrapper<Transaction>(
      `UPDATE l_transactions SET fulfilled = true WHERE id = $1 RETURNING *`,
      [id],
    );
    if (res.rowCount === 0) {
      throw new Error("Could not update row...");
    }
    return res.rows[0];
  }

  static async createTransaction(
    mint_pr: string,
    mint_hash: string,
    server_pr: string,
    server_hash: string,
    user: string,
    zapRequest: Event | undefined,
    amount: number,
  ) {
    const res = await queryWrapper<Transaction>(
      `INSERT INTO l_transactions
(mint_pr, mint_hash, server_pr, server_hash, "user", zap_request, fulfilled, amount)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`,
      [
        mint_pr,
        mint_hash,
        server_pr,
        server_hash,
        user,
        zapRequest,
        false,
        amount,
      ],
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
      mint_hash,
      user,
      Math.floor(new Date(res.rows[0].created_at).getTime() / 1000),
      zapRequest,
      false,
      amount,
    );
  }

  static async createCashuTransaction(
    quoteId: string,
    paymentRequest: string,
    user: string,
    zapRequest: Event | undefined,
    amount: number,
  ) {
    const res = await queryWrapper<Transaction>(
      `INSERT INTO l_transactions
(mint_pr, mint_hash, server_pr, server_hash, cashu_quote_id, "user", zap_request, fulfilled, amount, mint_url)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        paymentRequest,
        quoteId,
        paymentRequest,
        quoteId,
        quoteId,
        user,
        zapRequest,
        false,
        amount,
        process.env.MINTURL!,
      ],
    );
    if (res.rowCount === 0) {
      throw new Error("Failed to create new Transaction");
    }
    return Transaction.fromRow(res.rows[0]);
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
      res.rows[0].cashu_quote_id || res.rows[0].mint_hash,
      res.rows[0].user,
      Math.floor(new Date(res.rows[0].created_at).getTime() / 1000),
      res.rows[0].zap_request,
      res.rows[0].fulfilled,
      res.rows[0].amount,
    );
  }

  static async getTransactionByQuoteId(quoteId: string) {
    const res = await queryWrapper<Transaction>(
      `SELECT * from l_transactions WHERE cashu_quote_id = $1 OR mint_hash = $1 OR server_hash = $1`,
      [quoteId],
    );
    if (res.rowCount === 0) {
      throw new Error("Transaction not found in db");
    }
    return Transaction.fromRow(res.rows[0]);
  }

  static async getUnfulfilledCashuTransactions() {
    const res = await queryWrapper<Transaction>(
      `SELECT * FROM l_transactions WHERE fulfilled = false AND cashu_quote_id IS NOT NULL`,
      [],
    );
    return res.rows.map((row) => Transaction.fromRow(row));
  }

  private static fromRow(row: Transaction) {
    return new Transaction(
      row.id,
      row.mint_pr,
      row.mint_hash,
      row.server_pr,
      row.server_hash,
      row.cashu_quote_id || row.mint_hash,
      row.user,
      Math.floor(new Date(row.created_at).getTime() / 1000),
      row.zap_request,
      row.fulfilled,
      row.amount,
    );
  }
}
