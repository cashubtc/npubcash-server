import { nip19 } from "nostr-tools";
import { UserRepository } from "./userRepository";
import { BadRequestError, NotFoundError } from "@/errors";
import { User, UserWithName } from "./user";
import { usernameRegex } from "@/constants/regex";

export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async extractUserdataFromUserParam(userParam: string): Promise<{
    username: string;
    pubkey: string;
    isNpub: boolean;
    mintUrl: string;
    lockQuote: boolean;
  }> {
    if (userParam.startsWith("npub")) {
      const decoded = nip19.decode(userParam as `npub1${string}`);
      const userObj = await this.userRepo.getUserByPubkey(decoded.data);
      return {
        username: userParam,
        pubkey: decoded.data,
        isNpub: true,
        mintUrl: userObj?.mintUrl || process.env.MINTURL!,
        lockQuote: userObj?.lockQuote || false,
      };
    } else {
      const userObj = await this.userRepo.getUserByName(
        userParam.toLowerCase(),
      );
      if (!userObj) {
        throw new NotFoundError("User not found.");
      }
      return {
        username: userObj.name!,
        pubkey: userObj.pubkey,
        isNpub: false,
        mintUrl: userObj.mintUrl,
        lockQuote: userObj.lockQuote,
      };
    }
  }

  async getUserByName(name: string): Promise<UserWithName | null> {
    return this.userRepo.getUserByName(name);
  }

  async getUserByPubkey(pubkey: string): Promise<User | null> {
    return this.userRepo.getUserByPubkey(pubkey);
  }

  validateAndParseUsername(username: string) {
    const parsedUsername = username.toLowerCase().trim();
    if (!parsedUsername.match(usernameRegex) || parsedUsername.length < 3) {
      throw new BadRequestError("Invalid username!");
    }
    return parsedUsername;
  }

  async usernameExists(name: string) {
    const user = await this.userRepo.getUserByName(name);
    if (user) {
      return true;
    }
    return false;
  }

  createNewUser(
    pubkey: string,
    name?: string,
    mintUrl?: string,
    lockQuote?: boolean,
  ) {
    return new User({
      pubkey,
      name,
      mintUrl: mintUrl || process.env.MINTURL!,
      lockQuote: lockQuote || false,
    });
  }

  async saveUser(user: User) {
    return this.userRepo.saveUser(user);
  }

  async setUsername(pubkey: string, name: string) {
    return this.userRepo.upsertUsername(pubkey, name);
  }

  async setShouldLockQuote(pubkey: string, shouldLockQuote: boolean) {
    return this.userRepo.upsertLockQuote(shouldLockQuote, pubkey);
  }
}
