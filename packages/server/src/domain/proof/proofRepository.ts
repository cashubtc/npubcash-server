import { Proof } from "@cashu/cashu-ts";

export interface ProofRepository {
  saveProofs(proofs: Proof[]): Promise<void>;
}
