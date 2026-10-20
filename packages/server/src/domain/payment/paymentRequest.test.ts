import { expect, test } from "bun:test";
import { decodeCBOR } from "@/utils/cbor";
import {
  createCashuPaymentTerms,
  encodeCashuPaymentRequest,
} from "./paymentRequest";

test("encodes the same payment terms advertised during discovery", () => {
  const terms = createCashuPaymentTerms(5000, ["https://mint.example.com"]);
  const request = encodeCashuPaymentRequest(terms);
  const encodedPayload = request.slice("creqA".length);
  const payload = decodeCBOR(Buffer.from(encodedPayload, "base64url"));

  expect(payload).toEqual({
    a: terms.amount,
    u: terms.unit,
    m: terms.mints,
  });
});
