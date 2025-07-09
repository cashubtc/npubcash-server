import { SimplePool } from "nostr-tools";
import { CashuMint, CashuWallet } from "@cashu/cashu-ts";
import { LightningHandler } from "./utils/lightning";
import { BlinkProvider } from "./utils/blink";
import { PostgresUserRepository } from "./infrastructure/db/postgresUserRepository";
import { UserService } from "./domain/user/UserService";
import { CommunicatorService } from "./domain/communicator/CommunicatorService";
import { ProofService } from "./domain/proof/proofService";
import { PostgresProofRepository } from "./infrastructure/db/postgresProofRepository";
import { PostgresMintRepository } from "./infrastructure/db/postgresMintRepository";
import { MintService } from "./domain/mint/MintService";
import { QuoteSubscriptionManager } from "./websocket/subs";
import { eventBus } from "./events";

export const wallet = new CashuWallet(new CashuMint(process.env.MINTURL!));
export const lnProvider = new LightningHandler(new BlinkProvider());
export const nostrPool = new SimplePool();

export const userRepository = new PostgresUserRepository();
export const userService = new UserService(userRepository);
export const communicatorService = new CommunicatorService();
export const proofService = new ProofService(new PostgresProofRepository());
export const mintService = new MintService(new PostgresMintRepository());

export const subManager = new QuoteSubscriptionManager();
eventBus.on("quotePaid", (quote) => {
  subManager.update(quote.pubkey, quote);
});
