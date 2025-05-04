import { nip19 } from "nostr-tools";
import { UserRepository } from "./userRepository";
import { NotFoundError } from "@/errors";

export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async extractUserdataFromUserParam(userParam: string): Promise<{
    username: string;
    pubkey: string;
    isNpub: boolean;
    mintUrl: string;
  }> {
    if (userParam.startsWith("npub")) {
      const decoded = nip19.decode(userParam as `npub1${string}`);
      const userObj = await this.userRepo.getUserByPubkey(decoded.data);
      return {
        username: userParam,
        pubkey: decoded.data,
        isNpub: true,
        mintUrl: userObj?.mintUrl || process.env.MINTURL!,
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
      };
    }
  }
}
