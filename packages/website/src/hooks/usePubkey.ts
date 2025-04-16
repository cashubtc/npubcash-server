import { useEffect, useState } from "react";
import { useNostr } from "./useNostr";

export const usePubkey = () => {
  const nostr = useNostr();
  const [pubkey, setPubkey] = useState<string>();
  useEffect(() => {
    async function getPublicKey() {
      window.nostr.getPublicKey().then((pk) => setPubkey(pk));
    }
    if (nostr && !pubkey) {
      getPublicKey();
    }
  }, [nostr, pubkey]);
  return pubkey;
};
