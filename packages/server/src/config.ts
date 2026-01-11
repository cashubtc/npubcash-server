import { SimplePool } from "nostr-tools";
import { UserService } from "./domain/user/UserService";
import { CommunicatorService } from "./domain/communicator/CommunicatorService";
import { ProofService } from "./domain/proof/proofService";
import { MintService } from "./domain/mint/MintService";
import { QuoteSubscriptionManager } from "./websocket/subs";
import { eventBus } from "./events";
import { createRepositories } from "./infrastructure/db/repositoryFactory";
import { config } from "./config/index";

const repos = createRepositories(config.dbType);

export const nostrPool = new SimplePool();

export const userRepository = repos.userRepository;
export const mintQuoteRepository = repos.mintQuoteRepository;
export const userService = new UserService(repos.userRepository);
export const communicatorService = new CommunicatorService(repos.mintQuoteRepository);
export const proofService = new ProofService(repos.proofRepository);
export const mintService = new MintService(repos.mintRepository);

export const subManager = new QuoteSubscriptionManager();
eventBus.on("quotePaid", (quote) => {
  subManager.update(quote.pubkey, quote);
});
