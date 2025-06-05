import { User, UserWithName } from "./user";

export interface UserRepository {
  getUserByPubkey(pubkey: string): Promise<User | null>;
  getUserByName(name: string): Promise<UserWithName | null>;
  createUser(pubkey: string, name: string, mintUrl?: string): Promise<void>;
  upsertUsername(pubkey: string, name: string): Promise<User>;
  upsertLockQuote(shouldLockQuote: boolean, pubkey: string): Promise<void>;
  saveUser(user: User): Promise<void>;
}
