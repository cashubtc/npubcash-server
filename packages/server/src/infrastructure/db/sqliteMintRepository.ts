import { Mint } from "@/domain/mint/Mint";
import { MintRepository } from "@/domain/mint/MintRepository";
import { queryWrapper } from "@/utils/database";
import { GetInfoResponse } from "@cashu/cashu-ts";

type SqliteMint = {
  last_checked: string;
  mint_url: string;
  mint_info: string;
};

export class SqliteMintRepository implements MintRepository {
  async getMint(mintUrl: string): Promise<Mint | null> {
    const query = `SELECT * from mints WHERE mint_url = ?`;
    const res = await queryWrapper<SqliteMint>(query, [mintUrl]);
    if (res.rowCount === 0) {
      return null;
    }
    return this.dbMintToModel(res.rows[0]);
  }

  async saveMint(mint: Mint): Promise<void> {
    const query = `
INSERT INTO mints (mint_url, last_checked, mint_info)
VALUES (?, ?, ?)
ON CONFLICT (mint_url)
DO UPDATE SET
last_checked = excluded.last_checked,
mint_info = excluded.mint_info`;
    const queryRes = await queryWrapper(query, [
      mint.url,
      mint.lastChecked.toISOString(),
      JSON.stringify(mint.info),
    ]);
    if (queryRes.rowCount === 0) {
      throw new Error("Did not update mint");
    }
  }

  private dbMintToModel(dbMint: SqliteMint): Mint {
    return new Mint({
      url: dbMint.mint_url,
      info: JSON.parse(dbMint.mint_info) as GetInfoResponse,
      lastChecked: new Date(dbMint.last_checked),
    });
  }
}
