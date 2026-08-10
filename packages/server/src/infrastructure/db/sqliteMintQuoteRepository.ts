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
import {
  MintQuoteMonitoringStore,
  MintQuoteStateTransition,
} from "@/domain/mintQuoteMonitoring/MintQuoteMonitoringStore";

type MintQuoteRow = {
  id: number;
  created_at: string;
  unit: string;
  mint_url: string;
  payment_request: string;
  quote_id: string;
  expires_at: string;
  amount: number;
  pubkey: string;
  state: MintQuoteState;
  paid_at: string | null;
  serialized_zap_request: string | null;
  locked: number;
};

type MintRetryRow = {
  mint_url: string;
  failure_count: number;
  next_attempt_at: string;
  last_failure_at: string;
  last_error_category: MintRetryState["lastErrorCategory"];
};

type QuoteReconciliationRow = {
  mint_quote_id: number;
  last_checked_at: string | null;
  next_check_at: string;
  not_found_count: number;
  last_result: QuoteReconciliationState["lastResult"];
};

export class SqliteMintQuoteRepository
  implements
    MintQuoteRepository,
    MintQuoteMonitorStore,
    MintQuoteMonitoringStore
{
  constructor(private readonly db: DatabaseAdapter) {}

  async create(input: CreateMintQuoteInput): Promise<MintQuote> {
    const query = `
INSERT INTO mint_quotes (mint_url, payment_request, unit, quote_id, expires_at, amount, pubkey, state, serialized_zap_request, locked)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *`;
    const res = await this.db.query<MintQuoteRow>(query, [
      input.mintUrl,
      input.paymentRequest,
      input.unit,
      input.quoteId,
      input.expiresAt.toISOString(),
      input.amount,
      input.pubkey,
      "UNPAID",
      input.serializedZapRequest ?? null,
      input.locked ? 1 : 0,
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

  async getById(id: number): Promise<MintQuote | undefined> {
    const res = await this.db.query<MintQuoteRow>(
      "SELECT * FROM mint_quotes WHERE id = ?",
      [id],
    );
    const row = res.rows[0];
    return row ? this.castRowToQuote(row) : undefined;
  }

  async transitionState(
    transition: MintQuoteStateTransition,
  ): Promise<MintQuote | undefined> {
    if (transition.from.length === 0) return undefined;
    const statePlaceholders = transition.from.map(() => "?").join(", ");
    const res = await this.db.query<MintQuoteRow>(
      `UPDATE mint_quotes
       SET state = ?,
           paid_at = CASE
             WHEN ? IN ('PAID', 'ISSUED') THEN COALESCE(paid_at, ?)
             ELSE paid_at
           END
       WHERE id = ?
         AND state IN (${statePlaceholders})
       RETURNING *`,
      [
        transition.to,
        transition.to,
        transition.paidAt?.toISOString() ?? null,
        transition.id,
        ...transition.from,
      ],
    );
    const row = res.rows[0];
    return row ? this.castRowToQuote(row) : undefined;
  }

  async getMintRetryState(
    mintUrl: string,
  ): Promise<MintRetryState | undefined> {
    const res = await this.db.query<MintRetryRow>(
      "SELECT * FROM mint_quote_mint_retries WHERE mint_url = ?",
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
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(mint_url) DO UPDATE SET
         failure_count = excluded.failure_count,
         next_attempt_at = excluded.next_attempt_at,
         last_failure_at = excluded.last_failure_at,
         last_error_category = excluded.last_error_category`,
      [
        state.mintUrl,
        state.failureCount,
        state.nextAttemptAt.toISOString(),
        state.lastFailureAt.toISOString(),
        state.lastErrorCategory,
      ],
    );
  }

  async clearMintRetryState(mintUrl: string): Promise<void> {
    await this.db.query(
      "DELETE FROM mint_quote_mint_retries WHERE mint_url = ?",
      [mintUrl],
    );
  }

  async getQuoteReconciliationState(
    mintQuoteId: number,
  ): Promise<QuoteReconciliationState | undefined> {
    const res = await this.db.query<QuoteReconciliationRow>(
      "SELECT * FROM mint_quote_reconciliation WHERE mint_quote_id = ?",
      [mintQuoteId],
    );
    const row = res.rows[0];
    return row
      ? {
          mintQuoteId: row.mint_quote_id,
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
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(mint_quote_id) DO UPDATE SET
         last_checked_at = excluded.last_checked_at,
         next_check_at = excluded.next_check_at,
         not_found_count = excluded.not_found_count,
         last_result = excluded.last_result`,
      [
        state.mintQuoteId,
        state.lastCheckedAt?.toISOString() ?? null,
        state.nextCheckAt.toISOString(),
        state.notFoundCount,
        state.lastResult,
      ],
    );
  }

  async clearQuoteReconciliationState(mintQuoteId: number): Promise<void> {
    await this.db.query(
      "DELETE FROM mint_quote_reconciliation WHERE mint_quote_id = ?",
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

    // Build WHERE clause
    const conditions = ["pubkey = ?", "state IN ('PAID', 'ISSUED', 'INFLIGHT')"];
    const params: unknown[] = [pubkey];

    if (since) {
      conditions.push("paid_at > ?");
    }

    const whereClause = conditions.join(" AND ");

    // Get total count
    const countParams = since ? [pubkey, since.toISOString()] : [pubkey];
    const countRes = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM mint_quotes WHERE ${whereClause}`,
      countParams
    );
    const total = countRes.rows[0]?.count ?? 0;

    // Get paginated results
    const queryParams = since
      ? [pubkey, since.toISOString(), cappedLimit, offset]
      : [pubkey, cappedLimit, offset];

    const dataRes = await this.db.query<MintQuoteRow>(
      `SELECT * FROM mint_quotes WHERE ${whereClause} ORDER BY paid_at DESC LIMIT ? OFFSET ?`,
      queryParams
    );

    return {
      total,
      quotes: dataRes.rows.map((r) => this.castRowToQuote(r)),
    };
  }

  private castRowToQuote(row: MintQuoteRow): MintQuote {
    return new MintQuote({
      id: row.id,
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
      locked: Boolean(row.locked),
    });
  }
}
