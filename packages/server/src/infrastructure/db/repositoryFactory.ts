import { DatabaseAdapter } from "@/database/adapter";
import { MintRepository } from "@/domain/mint/MintRepository";
import { MintQuoteRepository } from "@/domain/mintQuote/MintQuoteRepository";
import { ProofRepository } from "@/domain/proof/proofRepository";
import { UserRepository } from "@/domain/user/userRepository";
import { PostgresMintRepository } from "./postgresMintRepository";
import { PostgresMintQuoteRepository } from "./postgresMintQuoteRepository";
import { PostgresProofRepository } from "./postgresProofRepository";
import { PostgresUserRepository } from "./postgresUserRepository";
import { SqliteMintRepository } from "./sqliteMintRepository";
import { SqliteMintQuoteRepository } from "./sqliteMintQuoteRepository";
import { SqliteProofRepository } from "./sqliteProofRepository";
import { SqliteUserRepository } from "./sqliteUserRepository";

export interface Repositories {
  userRepository: UserRepository;
  proofRepository: ProofRepository;
  mintRepository: MintRepository;
  mintQuoteRepository: MintQuoteRepository;
}

interface RepositoryFactoryConfig {
  mintUrl: string;
}

export function createRepositories(
  db: DatabaseAdapter,
  config: RepositoryFactoryConfig,
): Repositories {
  if (db.type === "sqlite") {
    return {
      userRepository: new SqliteUserRepository(db, config.mintUrl),
      proofRepository: new SqliteProofRepository(db),
      mintRepository: new SqliteMintRepository(db),
      mintQuoteRepository: new SqliteMintQuoteRepository(db),
    };
  }

  return {
    userRepository: new PostgresUserRepository(db, config.mintUrl),
    proofRepository: new PostgresProofRepository(db),
    mintRepository: new PostgresMintRepository(db),
    mintQuoteRepository: new PostgresMintQuoteRepository(db),
  };
}
