import { queryWrapper } from "@/utils/database";

interface MintQuoteConfig {
  id: number;
  createdAt: Date;
  mintUrl: string;
  unit: string;
  paymentRequest: string;
  quoteId: string;
  expiresAt: Date;
  amount: number;
  pubkey: string;
  state: "PAID" | "UNPAID" | "INFLIGHT" | "ISSUED" | "EXPIRED";
  paidAt?: Date;
  serializedZapRequest?: string;
  locked: boolean;
}

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
  state: "PAID" | "UNPAID" | "INFLIGHT" | "ISSUED" | "EXPIRED";
  paid_at: Date;
  serialized_zap_request: string;
  locked: boolean;
};

export class MintQuote implements MintQuoteConfig {
  id: number;
  createdAt: Date;
  mintUrl: string;
  unit: string;
  paymentRequest: string;
  quoteId: string;
  expiresAt: Date;
  amount: number;
  pubkey: string;
  state: "PAID" | "UNPAID" | "INFLIGHT" | "ISSUED" | "EXPIRED";
  paidAt?: Date;
  serializedZapRequest?: string;
  locked: boolean;
  private constructor(config: MintQuoteConfig) {
    this.id = config.id;
    this.createdAt = config.createdAt;
    this.mintUrl = config.mintUrl;
    this.unit = config.unit;
    this.paymentRequest = config.paymentRequest;
    this.quoteId = config.quoteId;
    this.expiresAt = config.expiresAt;
    this.amount = config.amount;
    this.pubkey = config.pubkey;
    this.state = config.state;
    this.paidAt = config.paidAt;
    this.serializedZapRequest = config.serializedZapRequest;
    this.locked = config.locked;
  }

  static castRowToQuote(row: MintQuoteRow) {
    return new MintQuote({
      id: row.id,
      createdAt: row.created_at,
      mintUrl: row.mint_url,
      unit: row.unit,
      paymentRequest: row.payment_request,
      quoteId: row.quote_id,
      expiresAt: row.expires_at,
      amount: row.amount,
      pubkey: row.pubkey,
      state: row.state,
      paidAt: row.paid_at,
      serializedZapRequest: row.serialized_zap_request,
      locked: row.locked,
    });
  }

  static async createNewMintQuoteInDb(
    config: Omit<MintQuoteConfig, "id" | "createdAt" | "state">,
  ): Promise<MintQuote> {
    const res = await queryWrapper<MintQuoteRow>(
      `INSERT INTO mint_quotes (mint_url, payment_request, unit, quote_id, expires_at, amount, pubkey, state, serialized_zap_request, locked) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        config.mintUrl,
        config.paymentRequest,
        config.unit,
        config.quoteId,
        config.expiresAt,
        config.amount,
        config.pubkey,
        "UNPAID",
        config.serializedZapRequest,
        config.locked,
      ],
    );
    if (res.rowCount === 0) {
      throw new Error("Failed to create new mint quote");
    }
    return this.castRowToQuote(res.rows[0]);
  }

  async setStateAndUpdateDb(newState: MintQuote["state"]) {
    const query = `UPDATE mint_quotes SET state = $1 WHERE id = $2`;
    const res = await queryWrapper(query, [newState, this.id]);
    if (res.rowCount === 0) {
      throw new Error("Failed to update state");
    }
    this.state = newState;
  }

  async setPaid(paidAt = new Date()) {
    const query = `UPDATE mint_quotes SET state = 'PAID', paid_at = $1 WHERE id = $2`;
    const res = await queryWrapper(query, [paidAt, this.id]);
    if (res.rowCount === 0) {
      throw new Error("Failed to update state");
    }
    this.state = "PAID";
    this.paidAt = paidAt;
  }

  static async getToBeExpiredMintQuotes() {
    const res = await queryWrapper<MintQuoteRow>(
      `SELECT * FROM mint_quotes WHERE expires_at <= NOW() AND state = "UNPAID"`,
      [],
    );
    return res.rows.map((r) => this.castRowToQuote(r));
  }

  static async getPendingMintQuotes() {
    const res = await queryWrapper<MintQuoteRow>(
      `SELECT * FROM mint_quotes WHERE state = 'UNPAID';`,
      [],
    );
    return res.rows.map((r) => this.castRowToQuote(r));
  }

  static async getUserMintHistory(
    pubkey: string,
    limit = 50,
    offset = 0,
    since?: Date,
  ) {
    const cappedLimit = Math.min(limit, 50);
    const filter = ["pubkey = $1", "state in ('PAID', 'ISSUED', 'INFLIGHT')"];
    if (since) {
      filter.push("paid_at > $4");
    }
    const query = `
    WITH total_count AS (
        SELECT COUNT(*)::int AS count
        FROM mint_quotes
        WHERE ${filter.join(" and ")}
    )
    SELECT t.*, total_count.count
    FROM total_count
    LEFT JOIN (
        SELECT *
        FROM mint_quotes
        WHERE ${filter.join(" and ")}
        ORDER BY paid_at DESC
        LIMIT $2 OFFSET $3
    ) t ON true;`;
    const res = await queryWrapper<MintQuoteRow & { count: number }>(
      query,
      since
        ? [pubkey, cappedLimit, offset, since]
        : [pubkey, cappedLimit, offset],
    );
    if (res.rows[0].id === null) {
      return {
        total: res.rows[0].count,
        mints: [],
      };
    }
    return {
      total: res.rows[0].count,
      mints: res.rows.map((r) => this.castRowToQuote(r)),
    };
  }

  static async bulkUpdateState(state: MintQuote["state"], quotes: MintQuote[]) {
    const idMap = new Map<number, MintQuote>();
    quotes.forEach((q) => {
      idMap.set(q.id, q);
    });
    const ids = [...idMap.keys()];
    const valueClause = ids.map((_, i) => "$" + (i + 2)).join(",");
    const query = `
    UPDATE mint_quotes
    SET state = $1
    WHERE id in (${valueClause});`;
    const queryRes = await queryWrapper<MintQuoteRow>(query, [state, ...ids]);
    queryRes.rows.forEach((r) => {
      const q = idMap.get(r.id);
      if (q) {
        q.state = state;
      }
    });
  }
}
