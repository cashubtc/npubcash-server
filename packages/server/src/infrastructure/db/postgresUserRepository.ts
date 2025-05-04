import { User } from "@/domain/user/user";
import { UserRepository } from "@/domain/user/userRepository";
import { queryWrapper } from "@/utils/database";

export class PostgresUserRepository implements UserRepository {
  async getUserByPubkey(pubkey: string): Promise<User | null> {
    const res = await queryWrapper<User>(
      `SELECT * from l_users WHERE pubkey = $1;`,
      [pubkey],
    );
    if (res.rowCount === 0) {
      return null;
    }
    return res.rows[0];
  }
  async getUserByName(name: string): Promise<User | null> {
    const res = await queryWrapper<User>(
      `SELECT * from l_users WHERE name = $1;`,
      [name],
    );
    if (res.rowCount === 0) {
      return null;
    }
    return res.rows[0];
  }
  async createUser(pubkey: string, name: string): Promise<void> {
    const res = await queryWrapper<User>(
      `INSERT INTO l_users (pubkey, name) VALUES ($1, $2);`,
      [pubkey, name],
    );
    if (res.rowCount === 0) {
      throw new Error("Could not create user");
    }
  }
}
