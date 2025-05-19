import { ProofRepository } from "@/domain/proof/proofRepository";
import { createBulkInsertQuery, queryWrapper } from "@/utils/database";
import { Proof } from "@cashu/cashu-ts";
import { Data } from "ws";

type ProofSpendState = "UNSPENT" | "INFLIGHT" | "SPENT";

class DatabaseProof {
  id: number;
  keyset_id: string;
  amount: number;
  secret: string;
  C: string;
  state: ProofSpendState;

  constructor(config: {
    id: number;
    keyset_id: string;
    amount: number;
    secret: string;
    C: string;
    state: ProofSpendState;
  }) {
    this.amount = config.amount;
    this.id = config.id;
    this.keyset_id = config.keyset_id;
    this.secret = config.secret;
    this.C = config.C;
    this.state = config.state;
  }

  toProof(): Proof {
    return {
      amount: this.amount,
      id: this.keyset_id,
      C: this.C,
      secret: this.secret,
    };
  }
}

export class PostgresProofRepository implements ProofRepository {
  async saveProofs(proofs: Proof[]): Promise<void> {
    const res = await createBulkInsertQuery<DatabaseProof>(
      "proofs",
      ["amount", "keyset_id", "secret", '"C"', "state"],
      proofs.map((p) => [p.amount, p.id, p.secret, p.C, "UNSPENT"]),
    );
    if (res.rowCount !== proofs.length) {
      throw new Error("Something went wrong adding proofs to db");
    }
  }
}
