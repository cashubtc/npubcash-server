import { User, UserWithName } from "@/domain/user/user";
import { UserRepository } from "@/domain/user/userRepository";
import { queryWrapper } from "@/utils/database";

type UserTableRow = {
  id: number;
  created_at: Date;
  pubkey: string;
  name: string | null;
  mint_url: string;
};

export class PostgresUserRepository implements UserRepository {
  async getUserByPubkey(pubkey: string): Promise<User | null> {
    const res = await queryWrapper<UserTableRow>(
      `SELECT * from l_users WHERE pubkey = $1;`,
      [pubkey],
    );
    if (res.rowCount === 0) {
      return null;
    }
    return this.castRowToUser(res.rows[0]);
  }
  async getUserByName(name: string): Promise<UserWithName | null> {
    const res = await queryWrapper<UserTableRow & { name: string }>(
      `SELECT * from l_users WHERE name = $1;`,
      [name],
    );
    if (res.rowCount === 0) {
      return null;
    }

    const user = this.castRowToUser(res.rows[0]);
    if (user instanceof UserWithName) {
      return user;
    }
    throw new Error("Invalid database return ");
  }
  async createUser(pubkey: string, name: string): Promise<void> {
    const res = await queryWrapper<UserTableRow>(
      `INSERT INTO l_users (pubkey, name) VALUES ($1, $2);`,
      [pubkey, name],
    );
    if (res.rowCount === 0) {
      throw new Error("Could not create user");
    }
  }

  async upsertUsername(pubkey: string, name: string): Promise<void> {
    const query = `
INSERT INTO l_users (pubkey, name)
VALUES ($1, $2)
ON CONFLICT (pubkey)
DO UPDATE SET name = $2;`;
    const params = [pubkey, process.env.MINTURL, name];
    const queryRes = await queryWrapper(query, params);
    if (queryRes.rowCount === 0) {
      throw new Error("Did not update username");
    }
  }

  async upsertLockQuote(
    shouldLockQuote: boolean,
    pubkey: string,
  ): Promise<void> {
    const query = `
INSERT INTRO l_users (pubkey, lock_quote)
VALUES ($1, $2)
ON CONFLICT (pubkey)
DO UPDATE SET lock_quote = $2;`;
    const queryRes = await queryWrapper(query, [shouldLockQuote, pubkey]);
    if (queryRes.rowCount === 0) {
      throw new Error("Did not update lock_quote");
    }
  }

  private castRowToUser(row: UserTableRow): User | UserWithName {
    if (row.name) {
      return new UserWithName({
        pubkey: row.pubkey,
        name: row.name,
        mintUrl: row.mint_url,
      });
    }
    return new User({
      pubkey: row.pubkey,
      mintUrl: row.mint_url,
    });
  }
}
