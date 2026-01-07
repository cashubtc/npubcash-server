import { ProofRepository } from "@/domain/proof/proofRepository";
import { queryWrapper } from "@/utils/database";
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

export class SqliteProofRepository implements ProofRepository {
  async saveProofs(proofs: Proof[]): Promise<void> {
    if (proofs.length === 0) {
      return;
    }

    const columns = ["amount", "keyset_id", "secret", '"C"', "state"];
    const placeholders = proofs
      .map(() => `(?, ?, ?, ?, ?)`)
      .join(", ");
    const values = proofs.flatMap((p) => [
      p.amount,
      p.id,
      p.secret,
      p.C,
      "UNSPENT",
    ]);

    const query = `INSERT INTO proofs (${columns.join(", ")}) VALUES ${placeholders}`;
    const res = await queryWrapper<DatabaseProof>(query, values);

    if (res.rowCount !== proofs.length) {
      throw new Error("Something went wrong adding proofs to db");
    }
  }
}
