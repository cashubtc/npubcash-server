import { useCallback, useEffect, useState } from "react";
import { initializeWallet, type Manager } from "@/lib/coco";
import type { Event, EventTemplate } from "nostr-tools";

interface NostrConfig {
  pubkey: string;
  signer: (t: EventTemplate) => Promise<Event>;
}

export function useWallet(config: NostrConfig | null) {
  const [manager, setManager] = useState<Manager | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!!config);

  const initialize = useCallback(
    async (signal: { cancelled: boolean }) => {
      if (!config) return;

      setIsLoading(true);
      setError(null);

      try {
        const m = await initializeWallet(config.pubkey, config.signer);
        if (!signal.cancelled) {
          setManager(m);
        }
      } catch (e) {
        if (!signal.cancelled) {
          console.error("Wallet initialization failed:", e);
          setError(e instanceof Error ? e.message : "Failed to initialize wallet");
        }
      } finally {
        if (!signal.cancelled) {
          setIsLoading(false);
        }
      }
    },
    [config],
  );

  useEffect(() => {
    if (!config) return;

    const signal = { cancelled: false };
    initialize(signal);

    return () => {
      signal.cancelled = true;
    };
  }, [config, initialize]);

  return { manager, error, isLoading };
}
