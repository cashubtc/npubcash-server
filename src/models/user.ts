import { queryWrapper } from "../utils/database";

export class User {
  pubkey: string;
  name: string;

  constructor(pubkey: string, name: string) {
    this.name = name;
    this.pubkey = pubkey;
  }

  static async createUser(pubkey: string, name: string) {
    const res = await queryWrapper(
      `INSERT INTO l_users (pubkey, name) VALUES ($1, $2)`,
      [pubkey, name],
    );
    if (res.rowCount === 0) {
      throw new Error("Could not create user");
    }
    return new User(pubkey, name);
  }
  static async getUserByPubkey(pubkey: string) {
    const res = await queryWrapper<User>(
      `SELECT * FROM l_users WHERE pubkey = $1`,
      [pubkey],
    );
    if (res.rowCount === 0) {
      return undefined;
    }
    return new User(res.rows[0].pubkey, res.rows[0].name);
  }
  static async getUserByName(name: string) {
    const res = await queryWrapper<User>(
      `SELECT * FROM l_users WHERE name = $1`,
      [name],
    );
    if (res.rowCount === 0) {
      return undefined;
    }
    return new User(res.rows[0].pubkey, res.rows[0].name);
  }
}
