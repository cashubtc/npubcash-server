import { queryWrapper } from "@/utils/database";

export class MintQuote {
  private constructor(
    public id: number,
    public created_at: number,
    public mint_url: string,
    public payment_request: string,
    public quote_id: string,
    public expires_at: Date,
    public amount: number,
    public pubkey: string,
    public state: "PAID" | "UNPAID" | "INFLIGHT" | "ISSUED" | "EXPIRED",
  ) {}

  static async createNewMintQuoteInDb(
    quote_id: string,
    expires_at: Date,
    payment_request: string,
    mint_url: string,
    amount: number,
    pubkey: string,
  ) {
    const res = await queryWrapper<MintQuote>(
      `INSERT INTO mint_quotes (mint_url, payment_request, quote_id, expires_at, amount, pubkey, state) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
      [
        mint_url,
        payment_request,
        quote_id,
        expires_at,
        amount,
        pubkey,
        "UNPAID",
      ],
    );
    if (res.rowCount === 0) {
      throw new Error("Failed to create new mint quote");
    }
    const row = res.rows[0];
    return new MintQuote(
      row.id,
      row.created_at,
      row.mint_url,
      row.payment_request,
      row.quote_id,
      row.expires_at,
      row.amount,
      row.pubkey,
      row.state,
    );
  }

  static async getToBeExpiredMintQuotes() {
    const res = await queryWrapper<MintQuote>(
      `SELECT * FROM mint_quotes WHERE expires_at <= NOW() AND state = "UNPAID"`,
      [],
    );
    return res.rows.map(
      (q) =>
        new MintQuote(
          q.id,
          q.created_at,
          q.mint_url,
          q.payment_request,
          q.quote_id,
          q.expires_at,
          q.amount,
          q.pubkey,
          q.state,
        ),
    );
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
    return res.rows.map(
      (r) =>
        new MintQuote(
          r.id,
          r.created_at,
          r.mint_url,
          r.payment_request,
          r.quote_id,
          r.expires_at,
          r.amount,
          r.pubkey,
          r.state,
        ),
    );
  }

  async setStateAndUpdateDb(newState: MintQuote["state"]) {
    const query = `UPDATE mint_quotes SET state = $1 WHERE id = $2`;
    const res = await queryWrapper(query, [newState, this.id]);
    if (res.rowCount === 0) {
      throw new Error("Failed to update state");
    }
    this.state = newState;
  }
}
