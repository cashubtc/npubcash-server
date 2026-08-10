import { DatabaseAdapter } from "@/database/adapter";
import { RecipientBlock } from "@/domain/recipientBlock/recipientBlock";
import { RecipientBlockRepository } from "@/domain/recipientBlock/recipientBlockRepository";

type RecipientBlockRow = {
  pubkey: string;
  created_at: string;
  reason: string | null;
};

export class SqliteRecipientBlockRepository
  implements RecipientBlockRepository
{
  constructor(private readonly db: DatabaseAdapter) {}

  async getAll(): Promise<RecipientBlock[]> {
    const result = await this.db.query<RecipientBlockRow>(
      `SELECT pubkey, created_at, reason
       FROM recipient_blocks
       ORDER BY pubkey`,
    );

    return result.rows.map((row) => ({
      pubkey: row.pubkey,
      createdAt: new Date(row.created_at),
      reason: row.reason,
    }));
  }
}
