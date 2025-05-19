import { Proof } from "@cashu/cashu-ts";
import { ProofRepository } from "./proofRepository";

export class ProofService {
  private readonly repo: ProofRepository;

  constructor(repo: ProofRepository) {
    this.repo = repo;
  }

  async saveProofs(proofs: Proof[]) {
    return this.repo.saveProofs(proofs);
  }
}
