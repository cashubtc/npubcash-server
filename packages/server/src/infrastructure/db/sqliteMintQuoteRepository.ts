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
  MintQuoteMonitoringStore,
  MintQuoteStateTransition,
  TakeDueForPollingInput,
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
  polling_order?: number;
};

export class SqliteMintQuoteRepository
  implements MintQuoteRepository, MintQuoteMonitoringStore
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

  async getById(id: number): Promise<MintQuote | undefined> {
    const res = await this.db.query<MintQuoteRow>(
      "SELECT * FROM mint_quotes WHERE id = ?",
      [id],
    );
    const row = res.rows[0];
    return row ? this.castRowToQuote(row) : undefined;
  }

  async getActiveUnpaidQuotes(now: Date): Promise<MintQuote[]> {
    const res = await this.db.query<MintQuoteRow>(
      `SELECT * FROM mint_quotes
       WHERE state = 'UNPAID' AND expires_at > ?
       ORDER BY id`,
      [now.toISOString()],
    );
    return res.rows.map((row) => this.castRowToQuote(row));
  }

  async takeDueForPolling(
    input: TakeDueForPollingInput,
  ): Promise<MintQuote[]> {
    if (!Number.isInteger(input.limit) || input.limit <= 0) return [];

    const res = await this.db.query<MintQuoteRow>(
      `WITH due AS (
         SELECT id,
                row_number() OVER (
                  ORDER BY last_polled_at IS NOT NULL, last_polled_at, id
                ) AS polling_order
         FROM mint_quotes
         WHERE state = 'UNPAID'
           AND (last_polled_at IS NULL OR last_polled_at <= ?)
         ORDER BY last_polled_at IS NOT NULL, last_polled_at, id
         LIMIT ?
       )
       UPDATE mint_quotes
       SET last_polled_at = ?
       WHERE id IN (SELECT id FROM due)
       RETURNING *,
         (SELECT polling_order FROM due WHERE due.id = mint_quotes.id) AS polling_order`,
      [
        input.dueBefore.toISOString(),
        input.limit,
        input.polledAt.toISOString(),
      ],
    );

    return res.rows
      .sort((a, b) => Number(a.polling_order) - Number(b.polling_order))
      .map((row) => this.castRowToQuote(row));
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
