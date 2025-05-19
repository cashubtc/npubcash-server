import { Mint } from "./Mint";

export interface MintRepository {
  getMint(mintUrl: string): Promise<Mint | null>;
  saveMint(mint: Mint): Promise<void>;
}
