import { queryWrapper } from "../utils/database";

export class User {
  pubkey: string;
  name: string;
  mint_url: string;

  constructor(pubkey: string, name: string, mint_url: string) {
    this.name = name;
    this.pubkey = pubkey;
    this.mint_url = mint_url;
  }

  static async createUser(pubkey: string, name: string, mint_url?: string) {
    const mintUrl = mint_url ? mint_url : process.env.MINTURL!;
    const res = await queryWrapper(
      `INSERT INTO l_users (pubkey, name) VALUES ($1, $2)`,
      [pubkey, name],
    );
    if (res.rowCount === 0) {
      throw new Error("Could not create user");
    }
    return new User(pubkey, name, mintUrl);
  }
  static async getUserByPubkey(pubkey: string) {
    const res = await queryWrapper<User>(
      `SELECT * FROM l_users WHERE pubkey = $1`,
      [pubkey],
    );
    if (res.rowCount === 0) {
      return undefined;
    }
    return new User(res.rows[0].pubkey, res.rows[0].name, res.rows[0].mint_url);
  }
  static async getUserByName(name: string) {
    const res = await queryWrapper<User>(
      `SELECT * FROM l_users WHERE name = $1`,
      [name],
    );
    if (res.rowCount === 0) {
      return undefined;
    }
    return new User(res.rows[0].pubkey, res.rows[0].name, res.rows[0].mint_url);
  }

  static async upsertMintByPubkey(pubkey: string, mintUrl: string) {
    const parsedUrl = new URL(mintUrl);
    const query = `
INSERT INTO l_users (pubkey, mint_url)
VALUES ($1, $2)
ON CONFLICT (pubkey)
DO UPDATE SET mint_url = $2`;
    const params = [pubkey, parsedUrl.toString()];
    const queryRes = await queryWrapper(query, params);
    if (queryRes.rowCount === 0) {
      throw new Error("Could not upsert into db");
    }
  }

  static async upsertUsernameByPubkey(pubkey: string, username: string) {
    const query = `
INSERT INTO l_users (pubkey, mint_url, name)
VALUES ($1, $2, $3)
ON CONFLICT (pubkey)
DO UPDATE SET name = $3
WHERE l_users.name IS NULL;`;
    const params = [pubkey, process.env.MINTURL, username];
    const queryRes = await queryWrapper(query, params);
    if (queryRes.rowCount === 0) {
      throw new Error("Did not update username");
    }
  }

  async upsertMintByPubkey(mintUrl: string) {
    await User.upsertMintByPubkey(this.pubkey, mintUrl);
    this.mint_url = this.mint_url;
  }
}
