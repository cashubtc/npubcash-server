import { Token } from "@cashu/cashu-ts";
import { useMemo } from "react";

const useTokenAmount = (decodedToken: Token | null) => {
  const amount = useMemo(() => {
    try {
      if (decodedToken) {
        const proofs = decodedToken.token.map((entry) => entry.proofs).flat();
        return proofs.reduce((a, c) => a + c.amount, 0);
      }
    } catch (e) {
      return 0;
    }
  }, [decodedToken]);

  const fees = useMemo(() => {
    if (amount) {
      return Math.max(Math.round(amount * 0.02), 3);
    }
    return 0;
  }, [amount]);
  return { tokenAmount: amount, lightningFees: fees };
};

export default useTokenAmount;
