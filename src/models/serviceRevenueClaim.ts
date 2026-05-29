import { Proof } from "@cashu/cashu-ts";
import { createBulkInsertQuery, queryWrapper } from "../utils/database";

export class ServiceRevenueClaim {
  static async createClaims(
    quoteId: string,
    paymentRequest: string,
    amount: number,
    proofs: Proof[],
  ) {
    const existing = await ServiceRevenueClaim.getClaimsByQuoteId(quoteId);
    if (existing.length > 0) {
      return;
    }
    const nestedValues = proofs.map((proof) => [
      quoteId,
      paymentRequest,
      amount,
      proof,
    ]);
    const res = await createBulkInsertQuery(
      "l_service_revenue_claims",
      ["quote_id", "payment_request", "amount", "proof"],
      nestedValues,
    );
    if (res.rowCount === 0) {
      throw new Error("Failed to create service revenue claims");
    }
  }

  static async getClaimsByQuoteId(quoteId: string) {
    const res = await queryWrapper<{ proof: Proof }>(
      `SELECT proof FROM l_service_revenue_claims WHERE quote_id = $1`,
      [quoteId],
    );
    return res.rows.map((row) => row.proof);
  }
}
