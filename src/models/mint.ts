import { queryWrapper } from "@/utils/database";

export class MintQuote {
  private constructor(
    public id: number,
    public created_at: number,
    public mint_url: string,
    public payment_request: string,
    public quote_id: string,
    public expires_at: Date,
    public state: "PAID" | "UNPAID" | "ISSUED" | "EXPIRED",
  ) {}

  static async createNewMintQuoteInDb(
    quote_id: string,
    expires_at: Date,
    payment_request: string,
    mint_url: string,
  ) {
    const res = await queryWrapper<MintQuote>(
      `INSERT INTO mint_quotes (mint_url, payment_request, quote_id, expires_at, state) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [mint_url, payment_request, quote_id, expires_at, "UNPAID"],
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
          q.state,
        ),
    );
  }

  async setStateAndUpdateDb(newState: "PAID" | "ISSUED" | "EXPIRED") {
    const query = `UPDATE mint_quotes SET state = $1 WHERE id = $2`;
    const res = await queryWrapper(query, [newState, this.id]);
    if (res.rowCount === 0) {
      throw new Error("Failed to update state");
    }
    this.state = newState;
  }
}
