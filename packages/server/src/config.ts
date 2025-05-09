import { SimplePool } from "nostr-tools";
import { CashuMint, CashuWallet } from "@cashu/cashu-ts";
import { LightningHandler } from "./utils/lightning";
import { BlinkProvider } from "./utils/blink";
import { PostgresUserRepository } from "./infrastructure/db/postgresUserRepository";
import { UserService } from "./domain/user/UserService";
import { CommunicatorService } from "./domain/communicator/CommunicatorService";

export const wallet = new CashuWallet(new CashuMint(process.env.MINTURL!));
export const lnProvider = new LightningHandler(new BlinkProvider());
export const nostrPool = new SimplePool();

export const userRepository = new PostgresUserRepository();
export const userService = new UserService(userRepository);
export const communicatorService = new CommunicatorService();
