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
