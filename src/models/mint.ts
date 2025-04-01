import { queryWrapper } from "@/utils/database";

interface MintQuoteConfig {
  id: number;
  created_at: number;
  mint_url: string;
  payment_request: string;
  quote_id: string;
  expires_at: Date;
  amount: number;
  pubkey: string;
  state: "PAID" | "UNPAID" | "INFLIGHT" | "ISSUED" | "EXPIRED";
}

export class MintQuote implements MintQuoteConfig {
  id: number;
  created_at: number;
  mint_url: string;
  payment_request: string;
  quote_id: string;
  expires_at: Date;
  amount: number;
  pubkey: string;
  state: "PAID" | "UNPAID" | "INFLIGHT" | "ISSUED" | "EXPIRED";
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
  }

  static async createNewMintQuoteInDb(
    config: Omit<MintQuoteConfig, "id" | "created_at" | "state">,
  ) {
    const res = await queryWrapper<MintQuoteConfig>(
      `INSERT INTO mint_quotes (mint_url, payment_request, quote_id, expires_at, amount, pubkey, state) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
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

  static async getToBeExpiredMintQuotes() {
    const res = await queryWrapper<MintQuote>(
      `SELECT * FROM mint_quotes WHERE expires_at <= NOW() AND state = "UNPAID"`,
      [],
    );
    return res.rows.map((r) => new MintQuote(r));
  }

  static async getPaidMintAmount(pubkey: string) {
    const query = `SELECT
      SUM((amount)::INT) AS total_amount
      FROM
      mint_quotes
      WHERE pubkey = $1 and state = 'PAID';
    `;
    const res = await queryWrapper(query, [pubkey]);
    if (res.rows.length < 1 || !res.rows[0].total_amount) {
      return 0;
    }
    return res.rows[0].total_amount;
  }

  static async getReadyMintQuotes(pubkey: string) {
    const query = `
    SELECT * FROM mint_quotes
    WHERE pubkey = $1 and (state = 'INFLIGHT' or state = 'PAID');
    `;
    const res = await queryWrapper<MintQuote>(query, [pubkey]);
    return res.rows.map((r) => new MintQuote(r));
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
