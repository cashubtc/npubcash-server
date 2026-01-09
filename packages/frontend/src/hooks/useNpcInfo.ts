import { useManager } from "coco-cashu-react";
import type { User } from "npubcash-types";
import { useCallback, useEffect, useState } from "react";

export const useNpcInfo = () => {
  const [info, setInfo] = useState<User>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const manager = useManager();

  const refetch = useCallback(
    async (signal?: { cancelled: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const info = await manager.ext.npc.getInfo();
        if (!signal?.cancelled) {
          setInfo(info);
        }
      } catch (e) {
        console.error(e);
        if (!signal?.cancelled && e instanceof Error) {
          setError(e.message);
        }
      } finally {
        if (!signal?.cancelled) {
          setLoading(false);
        }
      }
    },
    [manager],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    refetch(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [refetch]);

  return { info, error, loading, refetch };
};
