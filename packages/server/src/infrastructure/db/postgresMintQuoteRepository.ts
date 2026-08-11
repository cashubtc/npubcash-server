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
  DueMintQueue,
  ListDueMintQueuesInput,
  MintQuoteMonitoringStore,
  MintQuoteStateTransition,
  TakeDueForMintPollingInput,
} from "@/domain/mintQuoteMonitoring/MintQuoteMonitoringStore";
import { buildDueMintQueues } from "@/domain/mintQuoteMonitoring/buildDueMintQueues";

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
  polling_order?: number | string;
};

type DueMintQueueRow = {
  mint_url: string;
  oldest_due_at: Date | null;
};

export class PostgresMintQuoteRepository
  implements MintQuoteRepository, MintQuoteMonitoringStore
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

  async getById(id: number): Promise<MintQuote | undefined> {
    const res = await this.db.query<MintQuoteRow>(
      "SELECT * FROM mint_quotes WHERE id = $1",
      [id],
    );
    const row = res.rows[0];
    return row ? this.castRowToQuote(row) : undefined;
  }

  async getActiveUnpaidQuotes(now: Date): Promise<MintQuote[]> {
    const res = await this.db.query<MintQuoteRow>(
      `SELECT * FROM mint_quotes
       WHERE state = 'UNPAID' AND expires_at > $1
       ORDER BY id`,
      [now],
    );
    return res.rows.map((row) => this.castRowToQuote(row));
  }

  async listDueMintQueues(
    input: ListDueMintQueuesInput,
  ): Promise<DueMintQueue[]> {
    if (!Number.isInteger(input.limit) || input.limit <= 0) return [];

    const res = await this.db.query<DueMintQueueRow>(
      `SELECT mint_url,
              CASE
                WHEN COUNT(last_polled_at) < COUNT(*) THEN NULL
                ELSE MIN(last_polled_at)
              END AS oldest_due_at
       FROM mint_quotes
       WHERE state = 'UNPAID'
         AND (last_polled_at IS NULL OR last_polled_at <= $1)
       GROUP BY mint_url
       ORDER BY mint_url`,
      [input.dueBefore],
    );

    return buildDueMintQueues(
      res.rows.map((row) => ({
        mintUrl: row.mint_url,
        oldestDueAt: row.oldest_due_at,
      })),
      input.limit,
      input.excludedMintUrls,
    );
  }

  async takeDueForMintPolling(
    input: TakeDueForMintPollingInput,
  ): Promise<MintQuote[]> {
    if (
      !Number.isInteger(input.limit) ||
      input.limit <= 0 ||
      input.mintUrlAliases.length === 0
    ) {
      return [];
    }

    const aliases = [...new Set(input.mintUrlAliases)];
    const res = await this.db.query<MintQuoteRow>(
      `WITH candidates AS MATERIALIZED (
         SELECT id, last_polled_at
         FROM mint_quotes
         WHERE state = 'UNPAID'
           AND mint_url = ANY($2::text[])
           AND (last_polled_at IS NULL OR last_polled_at <= $1)
         ORDER BY last_polled_at NULLS FIRST, id
         LIMIT $3
         FOR UPDATE SKIP LOCKED
       ),
       due AS (
         SELECT id,
                row_number() OVER (
                  ORDER BY last_polled_at NULLS FIRST, id
                ) AS polling_order
         FROM candidates
       ),
       updated AS (
         UPDATE mint_quotes AS quote
         SET last_polled_at = $4
         FROM due
         WHERE quote.id = due.id
         RETURNING quote.*
       )
       SELECT updated.*, due.polling_order
       FROM updated
       JOIN due ON due.id = updated.id
       ORDER BY due.polling_order`,
      [input.dueBefore, aliases, input.limit, input.polledAt],
    );

    return res.rows.map((row) => this.castRowToQuote(row));
  }

  async transitionState(
    transition: MintQuoteStateTransition,
  ): Promise<MintQuote | undefined> {
    if (transition.from.length === 0) return undefined;
    const statePlaceholders = transition.from
      .map((_, index) => `$${index + 4}`)
      .join(", ");
    const res = await this.db.query<MintQuoteRow>(
      `UPDATE mint_quotes
       SET state = $1,
           paid_at = CASE
             WHEN $1 IN ('PAID', 'ISSUED') THEN COALESCE(paid_at, $2)
             ELSE paid_at
           END
       WHERE id = $3
         AND state IN (${statePlaceholders})
       RETURNING *`,
      [
        transition.to,
        transition.paidAt ?? null,
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
    since?: Date,
  ): Promise<UserMintHistoryResult> {
    const cappedLimit = Math.min(limit, 50);

    // Build WHERE clause with positional parameters
    const conditions = [
      "pubkey = $1",
      "state IN ('PAID', 'ISSUED', 'INFLIGHT')",
    ];
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
      countParams,
    );
    const total = Number(countRes.rows[0]?.count ?? 0);

    // Get paginated results
    const queryParams = since
      ? [pubkey, since, cappedLimit, offset]
      : [pubkey, cappedLimit, offset];

    const dataRes = await this.db.query<MintQuoteRow>(
      `SELECT * FROM mint_quotes WHERE ${whereClause} ORDER BY paid_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
      queryParams,
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
