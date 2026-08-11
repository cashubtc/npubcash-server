import { DatabaseAdapter } from "@/database/adapter";
import { MintRepository } from "@/domain/mint/MintRepository";
import { MintQuoteRepository } from "@/domain/mintQuote/MintQuoteRepository";
import { MintQuoteMonitorStore } from "@/domain/mintQuoteMonitor/MintQuoteMonitorStore";
import { ProofRepository } from "@/domain/proof/proofRepository";
import { UserRepository } from "@/domain/user/userRepository";
import { RecipientBlockRepository } from "@/domain/recipientBlock/recipientBlockRepository";
import { PostgresRecipientBlockRepository } from "./postgresRecipientBlockRepository";
import { PostgresMintRepository } from "./postgresMintRepository";
import { PostgresMintQuoteRepository } from "./postgresMintQuoteRepository";
import { PostgresProofRepository } from "./postgresProofRepository";
import { PostgresUserRepository } from "./postgresUserRepository";
import { SqliteMintRepository } from "./sqliteMintRepository";
import { SqliteMintQuoteRepository } from "./sqliteMintQuoteRepository";
import { SqliteProofRepository } from "./sqliteProofRepository";
import { SqliteUserRepository } from "./sqliteUserRepository";
import { SqliteRecipientBlockRepository } from "./sqliteRecipientBlockRepository";

export interface Repositories {
  userRepository: UserRepository;
  proofRepository: ProofRepository;
  mintRepository: MintRepository;
  mintQuoteRepository: MintQuoteRepository;
  mintQuoteMonitorStore: MintQuoteMonitorStore;
  recipientBlockRepository: RecipientBlockRepository;
}

interface RepositoryFactoryConfig {
  mintUrl: string;
}

export function createRepositories(
  db: DatabaseAdapter,
  config: RepositoryFactoryConfig,
): Repositories {
  if (db.type === "sqlite") {
    const mintQuoteRepository = new SqliteMintQuoteRepository(db);
    return {
      userRepository: new SqliteUserRepository(db, config.mintUrl),
      proofRepository: new SqliteProofRepository(db),
      mintRepository: new SqliteMintRepository(db),
      mintQuoteRepository,
      mintQuoteMonitorStore: mintQuoteRepository,
      recipientBlockRepository: new SqliteRecipientBlockRepository(db),
    };
  }

  const mintQuoteRepository = new PostgresMintQuoteRepository(db);
  return {
    userRepository: new PostgresUserRepository(db, config.mintUrl),
    proofRepository: new PostgresProofRepository(db),
    mintRepository: new PostgresMintRepository(db),
    mintQuoteRepository,
    mintQuoteMonitorStore: mintQuoteRepository,
    recipientBlockRepository: new PostgresRecipientBlockRepository(db),
  };
}
