import { describe, expect, it } from "vitest";
import { hashToCurve } from "@cashu/cashu-ts/dist/lib/es5/DHKE";
import { legacyHashToCurve } from "../cashu";

describe("cashu hash to curve", () => {
  it("uses the domain-separated Cashu hash-to-curve vector", () => {
    const secret = new Uint8Array(32);

    expect(hashToCurve(secret).toHex(true)).toBe(
      "024cce997d3b518f739663b757deaec95bcd9473c30a14ac2fd04023a739d1a725",
    );
  });

  it("retains the legacy identifier for stored-proof state checks", () => {
    const secret = new Uint8Array(32);

    expect(legacyHashToCurve(secret)).toBe(
      "0266687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925",
    );
  });
});
