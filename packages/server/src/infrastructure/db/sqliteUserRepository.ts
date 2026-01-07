import { User, UserWithName } from "@/domain/user/user";
import { UserRepository } from "@/domain/user/userRepository";
import { queryWrapper } from "@/utils/database";

type UserTableRow = {
  id: number;
  created_at: string;
  pubkey: string;
  name: string | null;
  mint_url: string;
  lock_quote: number;
};

export class SqliteUserRepository implements UserRepository {
  async getUserByPubkey(pubkey: string): Promise<User | null> {
    const res = await queryWrapper<UserTableRow>(
      `SELECT * from l_users WHERE pubkey = ?;`,
      [pubkey],
    );
    if (res.rowCount === 0) {
      return null;
    }
    return this.castRowToUser(res.rows[0]);
  }

  async getUserByName(name: string): Promise<UserWithName | null> {
    const res = await queryWrapper<UserTableRow & { name: string }>(
      `SELECT * from l_users WHERE name = ?;`,
      [name],
    );
    if (res.rowCount === 0) {
      return null;
    }

    const user = this.castRowToUser(res.rows[0]);
    if (user instanceof UserWithName) {
      return user;
    }
    throw new Error("Invalid database return");
  }

  async createUser(pubkey: string, name: string): Promise<void> {
    const res = await queryWrapper<UserTableRow>(
      `INSERT INTO l_users (pubkey, name) VALUES (?, ?);`,
      [pubkey, name],
    );
    if (res.rowCount === 0) {
      throw new Error("Could not create user");
    }
  }

  async upsertUsername(pubkey: string, name: string): Promise<User> {
    const query = `
INSERT INTO l_users (pubkey, mint_url, name)
VALUES (?, ?, ?)
ON CONFLICT (pubkey)
DO UPDATE SET name = excluded.name
RETURNING *;`;
    const params = [pubkey, process.env.MINTURL, name];
    const queryRes = await queryWrapper<UserTableRow>(query, params);
    if (queryRes.rowCount === 0) {
      throw new Error("Did not update username");
    }
    return this.castRowToUser(queryRes.rows[0]);
  }

  async upsertLockQuote(
    shouldLockQuote: boolean,
    pubkey: string,
  ): Promise<void> {
    const query = `
INSERT INTO l_users (lock_quote, pubkey)
VALUES (?, ?)
ON CONFLICT (pubkey)
DO UPDATE SET lock_quote = excluded.lock_quote;`;
    const queryRes = await queryWrapper(query, [
      shouldLockQuote ? 1 : 0,
      pubkey,
    ]);
    if (queryRes.rowCount === 0) {
      throw new Error("Did not update lock_quote");
    }
  }

  async saveUser(user: User): Promise<void> {
    const query = `
INSERT INTO l_users (pubkey, name, mint_url, lock_quote)
VALUES (?, ?, ?, ?)
ON CONFLICT (pubkey)
DO UPDATE SET
name = excluded.name,
mint_url = excluded.mint_url,
lock_quote = excluded.lock_quote;
`;
    const queryRes = await queryWrapper(query, [
      user.pubkey,
      user.name,
      user.mintUrl,
      user.lockQuote ? 1 : 0,
    ]);
    if (queryRes.rowCount === 0) {
      throw new Error("Did not update user");
    }
  }

  private castRowToUser(row: UserTableRow): User | UserWithName {
    if (row.name) {
      return new UserWithName({
        pubkey: row.pubkey,
        name: row.name,
        mintUrl: row.mint_url,
        lockQuote: Boolean(row.lock_quote),
      });
    }
    return new User({
      pubkey: row.pubkey,
      mintUrl: row.mint_url,
      lockQuote: Boolean(row.lock_quote),
    });
  }
}
