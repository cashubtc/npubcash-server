import { createHash } from "crypto";
import {
  hashToCurve,
  pointFromHex,
} from "@cashu/cashu-ts/dist/lib/es5/DHKE";

export type ProofStateYs = {
  current: string;
  legacy: string;
};

export function getProofStateYs(secret: string): ProofStateYs {
  const message = new TextEncoder().encode(secret);
  return {
    current: hashToCurve(message).toHex(true),
    legacy: legacyHashToCurve(message),
  };
}

export function legacyHashToCurve(message: Uint8Array): string {
  let messageToHash = message;
  for (let counter = 0; counter < 2 ** 16; counter++) {
    const hash = createHash("sha256").update(messageToHash).digest();
    try {
      return pointFromHex(`02${hash.toString("hex")}`).toHex(true);
    } catch {
      messageToHash = hash;
    }
  }
  throw new Error("No valid legacy hash-to-curve point found");
}
