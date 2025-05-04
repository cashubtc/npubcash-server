import { User } from "./user";

export interface UserRepository {
  getUserByPubkey(pubkey: string): Promise<User | null>;
  getUserByName(name: string): Promise<User | null>;
  createUser(pubkey: string, name: string, mintUrl?: string): Promise<void>;
}
