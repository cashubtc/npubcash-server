import { getDecodedToken } from "@cashu/cashu-ts";
import { useMemo } from "react";

const useDecodedToken = (token?: string) => {
  return useMemo(() => {
    if (token) {
      try {
        return getDecodedToken(token);
      } catch {
        return null;
      }
    }
    return null;
  }, [token]);
};

export default useDecodedToken;
