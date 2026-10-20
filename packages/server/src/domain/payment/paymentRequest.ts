import type { UsernamePaymentTerms } from "@npubcash/api-contract";
import { encodeCBOR } from "@/utils/cbor";

export function createCashuPaymentTerms(
  amount: number,
  mints: string[],
): UsernamePaymentTerms {
  return {
    amount,
    unit: "sat",
    mints: [...mints],
  };
}

export function encodeCashuPaymentRequest(
  terms: UsernamePaymentTerms,
): string {
  const payload = {
    a: terms.amount,
    u: terms.unit,
    m: terms.mints,
  };
  const cborPayload = encodeCBOR(payload);
  return "creqA" + Buffer.from(cborPayload).toString("base64url");
}
