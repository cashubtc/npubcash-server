import {
  MintQuote,
  MintQuoteState,
  CreateMintQuoteInput,
} from "@/domain/mintQuote/MintQuote";
import {
  MintQuoteRepository,
  UserMintHistoryResult,
} from "@/domain/mintQuote/MintQuoteRepository";
import { DatabaseAdapter } from "@/database/adapter";
import {
  MintQuoteMonitorStore,
  MintRetryState,
  QuoteReconciliationState,
} from "@/domain/mintQuoteMonitor/MintQuoteMonitorStore";

type MintQuoteRow = {
  id: number;
  created_at: Date;
  unit: string;
  mint_url: string;
  payment_request: string;
  quote_id: string;
  expires_at: Date;
  amount: number;
  pubkey: string;
  state: MintQuoteState;
  paid_at: Date | null;
  serialized_zap_request: string | null;
  locked: boolean;
};

type MintRetryRow = {
  mint_url: string;
  failure_count: number;
  next_attempt_at: Date;
  last_failure_at: Date;
  last_error_category: MintRetryState["lastErrorCategory"];
};

type QuoteReconciliationRow = {
  mint_quote_id: number;
  last_checked_at: Date | null;
  next_check_at: Date;
  not_found_count: number;
  last_result: QuoteReconciliationState["lastResult"];
};

export class PostgresMintQuoteRepository
  implements MintQuoteRepository, MintQuoteMonitorStore
{
  constructor(private readonly db: DatabaseAdapter) {}

  async create(input: CreateMintQuoteInput): Promise<MintQuote> {
    const query = `
INSERT INTO mint_quotes (mint_url, payment_request, unit, quote_id, expires_at, amount, pubkey, state, serialized_zap_request, locked)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *`;
    const res = await this.db.query<MintQuoteRow>(query, [
      input.mintUrl,
      input.paymentRequest,
      input.unit,
      input.quoteId,
      input.expiresAt,
      input.amount,
      input.pubkey,
      "UNPAID",
      input.serializedZapRequest ?? null,
      input.locked,
    ]);
    if (res.rowCount === 0) {
      throw new Error("Failed to create new mint quote");
    }
    return this.castRowToQuote(res.rows[0]);
  }

  async getRecoverableQuotes(): Promise<MintQuote[]> {
    const res = await this.db.query<MintQuoteRow>(
      `SELECT * FROM mint_quotes WHERE state = 'UNPAID'`,
      []
    );
    return res.rows.map((r) => this.castRowToQuote(r));
  }

  async transitionUnpaidQuote(
    id: number,
    state: "PAID" | "ISSUED" | "EXPIRED",
    paidAt?: Date,
  ): Promise<MintQuote | undefined> {
    const res = await this.db.query<MintQuoteRow>(
      `UPDATE mint_quotes
       SET state = $1,
           paid_at = CASE
             WHEN $1 IN ('PAID', 'ISSUED') THEN $2
             ELSE paid_at
           END
       WHERE id = $3
         AND (
           state = 'UNPAID'
           OR (state = 'EXPIRED' AND $1 IN ('PAID', 'ISSUED'))
           OR (state = 'PAID' AND $1 = 'ISSUED')
         )
       RETURNING *`,
      [state, paidAt ?? null, id],
    );
    const row = res.rows[0];
    return row ? this.castRowToQuote(row) : undefined;
  }

  async getMintRetryState(
    mintUrl: string,
  ): Promise<MintRetryState | undefined> {
    const res = await this.db.query<MintRetryRow>(
      "SELECT * FROM mint_quote_mint_retries WHERE mint_url = $1",
      [mintUrl],
    );
    const row = res.rows[0];
    return row
      ? {
          mintUrl: row.mint_url,
          failureCount: row.failure_count,
          nextAttemptAt: new Date(row.next_attempt_at),
          lastFailureAt: new Date(row.last_failure_at),
          lastErrorCategory: row.last_error_category,
        }
      : undefined;
  }

  async saveMintRetryState(state: MintRetryState): Promise<void> {
    await this.db.query(
      `INSERT INTO mint_quote_mint_retries
         (mint_url, failure_count, next_attempt_at, last_failure_at, last_error_category)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(mint_url) DO UPDATE SET
         failure_count = EXCLUDED.failure_count,
         next_attempt_at = EXCLUDED.next_attempt_at,
         last_failure_at = EXCLUDED.last_failure_at,
         last_error_category = EXCLUDED.last_error_category`,
      [
        state.mintUrl,
        state.failureCount,
        state.nextAttemptAt,
        state.lastFailureAt,
        state.lastErrorCategory,
      ],
    );
  }

  async clearMintRetryState(mintUrl: string): Promise<void> {
    await this.db.query(
      "DELETE FROM mint_quote_mint_retries WHERE mint_url = $1",
      [mintUrl],
    );
  }

  async getQuoteReconciliationState(
    mintQuoteId: number,
  ): Promise<QuoteReconciliationState | undefined> {
    const res = await this.db.query<QuoteReconciliationRow>(
      "SELECT * FROM mint_quote_reconciliation WHERE mint_quote_id = $1",
      [mintQuoteId],
    );
    const row = res.rows[0];
    return row
      ? {
          mintQuoteId: Number(row.mint_quote_id),
          lastCheckedAt: row.last_checked_at
            ? new Date(row.last_checked_at)
            : undefined,
          nextCheckAt: new Date(row.next_check_at),
          notFoundCount: row.not_found_count,
          lastResult: row.last_result,
        }
      : undefined;
  }

  async saveQuoteReconciliationState(
    state: QuoteReconciliationState,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO mint_quote_reconciliation
         (mint_quote_id, last_checked_at, next_check_at, not_found_count, last_result)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(mint_quote_id) DO UPDATE SET
         last_checked_at = EXCLUDED.last_checked_at,
         next_check_at = EXCLUDED.next_check_at,
         not_found_count = EXCLUDED.not_found_count,
         last_result = EXCLUDED.last_result`,
      [
        state.mintQuoteId,
        state.lastCheckedAt ?? null,
        state.nextCheckAt,
        state.notFoundCount,
        state.lastResult,
      ],
    );
  }

  async clearQuoteReconciliationState(mintQuoteId: number): Promise<void> {
    await this.db.query(
      "DELETE FROM mint_quote_reconciliation WHERE mint_quote_id = $1",
      [mintQuoteId],
    );
  }

  async getUserHistory(
    pubkey: string,
    limit = 50,
    offset = 0,
    since?: Date
  ): Promise<UserMintHistoryResult> {
    const cappedLimit = Math.min(limit, 50);

    // Build WHERE clause with positional parameters
    const conditions = ["pubkey = $1", "state IN ('PAID', 'ISSUED', 'INFLIGHT')"];
    if (since) {
      conditions.push("paid_at > $2");
    }
    const whereClause = conditions.join(" AND ");

    // Adjust parameter positions based on whether 'since' is provided
    const limitParam = since ? "$3" : "$2";
    const offsetParam = since ? "$4" : "$3";

    // Get total count
    const countParams = since ? [pubkey, since] : [pubkey];
    const countRes = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM mint_quotes WHERE ${whereClause}`,
      countParams
    );
    const total = Number(countRes.rows[0]?.count ?? 0);

    // Get paginated results
    const queryParams = since
      ? [pubkey, since, cappedLimit, offset]
      : [pubkey, cappedLimit, offset];

    const dataRes = await this.db.query<MintQuoteRow>(
      `SELECT * FROM mint_quotes WHERE ${whereClause} ORDER BY paid_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
      queryParams
    );

    return {
      total,
      quotes: dataRes.rows.map((r) => this.castRowToQuote(r)),
    };
  }

  private castRowToQuote(row: MintQuoteRow): MintQuote {
    return new MintQuote({
      id: Number(row.id),
      createdAt: new Date(row.created_at),
      mintUrl: row.mint_url,
      unit: row.unit,
      paymentRequest: row.payment_request,
      quoteId: row.quote_id,
      expiresAt: new Date(row.expires_at),
      amount: row.amount,
      pubkey: row.pubkey,
      state: row.state,
      paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
      serializedZapRequest: row.serialized_zap_request ?? undefined,
      locked: row.locked,
    });
  }
}
