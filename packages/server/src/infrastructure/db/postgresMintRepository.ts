import { Mint } from "@/domain/mint/Mint";
import { MintRepository } from "@/domain/mint/MintRepository";
import { DatabaseAdapter } from "@/database/adapter";
import { MintInfo } from "@cashu/cashu-ts";

type PostgresMint = {
  last_checked: Date;
  mint_url: string;
  mint_info: MintInfo;
};

export class PostgresMintRepository implements MintRepository {
  constructor(private readonly db: DatabaseAdapter) {}

  async getMint(mintUrl: string): Promise<Mint | null> {
    const query = `SELECT * from mints WHERE mint_url = $1`;
    const res = await this.db.query<PostgresMint>(query, [mintUrl]);
    if (res.rowCount === 0) {
      return null;
    }
    return this.dbMintToModel(res.rows[0]);
  }

  async saveMint(mint: Mint): Promise<void> {
    const query = `
INSERT INTO mints (mint_url, last_checked, mint_info)
VALUES ($1, $2, $3)
ON CONFLICT (mint_url)
DO UPDATE SET
last_checked = $2,
mint_info = $3`;
    const queryRes = await this.db.query(query, [
      mint.url,
      mint.lastChecked,
      mint.info,
    ]);
    if (queryRes.rowCount === 0) {
      throw new Error("Did not update mint");
    }
  }

  private dbMintToModel(dbMint: PostgresMint): Mint {
    return new Mint({
      url: dbMint.mint_url,
      info: dbMint.mint_info,
      lastChecked: dbMint.last_checked,
    });
  }
}
