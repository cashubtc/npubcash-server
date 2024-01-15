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
}
