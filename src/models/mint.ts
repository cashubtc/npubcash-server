import { queryWrapper } from "@/utils/database";

interface MintQuoteConfig {
  id: number;
  created_at: Date;
  mint_url: string;
  payment_request: string;
  quote_id: string;
  expires_at: Date;
  amount: number;
  pubkey: string;
  state: "PAID" | "UNPAID" | "INFLIGHT" | "ISSUED" | "EXPIRED";
  paid_at?: Date;
}

export class MintQuote implements MintQuoteConfig {
  id: number;
  created_at: Date;
  mint_url: string;
  payment_request: string;
  quote_id: string;
  expires_at: Date;
  amount: number;
  pubkey: string;
  state: "PAID" | "UNPAID" | "INFLIGHT" | "ISSUED" | "EXPIRED";
  paid_at?: Date;
  private constructor(config: MintQuoteConfig) {
    this.id = config.id;
    this.created_at = config.created_at;
    this.mint_url = config.mint_url;
    this.payment_request = config.payment_request;
    this.quote_id = config.quote_id;
    this.expires_at = config.expires_at;
    this.amount = config.amount;
    this.pubkey = config.pubkey;
    this.state = config.state;
    this.paid_at = config.paid_at;
  }

  static async createNewMintQuoteInDb(
    config: Omit<MintQuoteConfig, "id" | "created_at" | "state">,
  ) {
    const res = await queryWrapper<MintQuote>(
      `INSERT INTO mint_quotes (mint_url, payment_request, quote_id, expires_at, amount, pubkey, state) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        config.mint_url,
        config.payment_request,
        config.quote_id,
        config.expires_at,
        config.amount,
        config.pubkey,
        "UNPAID",
      ],
    );
    if (res.rowCount === 0) {
      throw new Error("Failed to create new mint quote");
    }
    return new MintQuote(res.rows[0]);
  }

  async setStateAndUpdateDb(newState: MintQuote["state"]) {
    const query = `UPDATE mint_quotes SET state = $1 WHERE id = $2`;
    const res = await queryWrapper(query, [newState, this.id]);
    if (res.rowCount === 0) {
      throw new Error("Failed to update state");
    }
    this.state = newState;
  }

  async setPaid(paid_at = new Date()) {
    const query = `UPDATE mint_quotes SET state = 'PAID', paid_at = $1 WHERE id = $2`;
    const res = await queryWrapper(query, [paid_at, this.id]);
    if (res.rowCount === 0) {
      throw new Error("Failed to update state");
    }
    this.state = "PAID";
    this.paid_at = paid_at;
  }

  static async getToBeExpiredMintQuotes() {
    const res = await queryWrapper<MintQuote>(
      `SELECT * FROM mint_quotes WHERE expires_at <= NOW() AND state = "UNPAID"`,
      [],
    );
    return res.rows.map((r) => new MintQuote(r));
  }

  //   WITH total_count AS (
  //     SELECT COUNT(*) AS count
  //     FROM l_claims_3
  //     ${whereClause}
  // )
  // SELECT l_claims_3.*, total_count.count
  // FROM l_claims_3, total_count
  // ${whereClause}
  // ORDER BY (proof->>'amount')::int DESC
  // LIMIT 100
  // OFFSET ${username ? "$3" : "$2"};

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
    WITH total_count as (
    SELECT COUNT(*)::int as count
    FROM mint_quotes
    WHERE ${filter.join(" and ")} 
    )
    SELECT mint_quotes.*, total_count.count FROM mint_quotes, total_count
    WHERE ${filter.join(" and ")} 
    ORDER BY paid_at DESC
    LIMIT $2 OFFSET $3;`;
    const res = await queryWrapper<MintQuote & { count: number }>(
      query,
      since
        ? [pubkey, cappedLimit, offset, since]
        : [pubkey, cappedLimit, offset],
    );
    return {
      total: res.rows[0].count,
      mints: res.rows.map((r) => new MintQuote(r)),
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
    const queryRes = await queryWrapper<MintQuote>(query, [state, ...ids]);
    queryRes.rows.forEach((r) => {
      const q = idMap.get(r.id);
      if (q) {
        q.state = state;
      }
    });
  }
}
