import { useEffect, useState } from "react";
import { pool } from "../main";
import { nip19 } from "nostr-tools";

export function useProfile(pubkey: string | undefined) {
  const [profile, setProfile] = useState<{ picture?: string; name?: string }>();

  useEffect(() => {
    async function getProfile(pk: string) {
      const profileEvent = await pool.get(["wss://relay.damus.io"], {
        authors: [pk],
        kinds: [0],
      });
      if (!profileEvent) {
        return;
      }
      const profileData = JSON.parse(profileEvent?.content);
      setProfile(profileData);
    }
    if (pubkey) {
      if (pubkey.startsWith("npub")) {
        getProfile(nip19.decode(pubkey as `npub1${string}`).data);
      } else {
        getProfile(pubkey);
      }
    }
  }, [pubkey]);
  return profile;
}
