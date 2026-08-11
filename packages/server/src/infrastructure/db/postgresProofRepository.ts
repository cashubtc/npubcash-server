import { ProofRepository } from "@/domain/proof/proofRepository";
import { DatabaseAdapter } from "@/database/adapter";
import { createBulkInsertPayload } from "@/utils/sql";
import { Proof } from "@cashu/cashu-ts";

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
  constructor(private readonly db: DatabaseAdapter) {}

  async saveProofs(proofs: Proof[]): Promise<void> {
    if (proofs.length === 0) {
      return;
    }

    const columns = ["amount", "keyset_id", "secret", '"C"', "state"];
    const payload = createBulkInsertPayload(
      columns,
      proofs.map((p) => [p.amount, p.id, p.secret, p.C, "UNSPENT"]),
    );
    const res = await this.db.query<DatabaseProof>(
      `INSERT INTO proofs (${columns.join(",")}) VALUES ${payload.valueString};`,
      payload.flatValues,
    );
    if (res.rowCount !== proofs.length) {
      throw new Error("Something went wrong adding proofs to db");
    }
  }
}
