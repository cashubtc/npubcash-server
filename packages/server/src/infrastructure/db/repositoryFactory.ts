import { DatabaseType } from "@/database/adapter";
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

export function createRepositories(dbType: DatabaseType): Repositories {
  if (dbType === "sqlite") {
    return {
      userRepository: new SqliteUserRepository(),
      proofRepository: new SqliteProofRepository(),
      mintRepository: new SqliteMintRepository(),
      mintQuoteRepository: new SqliteMintQuoteRepository(),
    };
  }

  return {
    userRepository: new PostgresUserRepository(),
    proofRepository: new PostgresProofRepository(),
    mintRepository: new PostgresMintRepository(),
    mintQuoteRepository: new PostgresMintQuoteRepository(),
  };
}
