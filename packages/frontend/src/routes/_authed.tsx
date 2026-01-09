import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { CocoCashuProvider } from "coco-cashu-react";
import { JWTAuthProvider, NPCClient } from "npubcash-sdk";
import { useAuth } from "@/contexts/AuthContext";
import { NPCProvider } from "@/contexts/NPCContext";
import { initializeWallet, type Manager } from "@/lib/coco";

const NPC_BASE_URL = import.meta.env.NPC_BASEURL ?? import.meta.env.HOSTNAME ?? "https://npubcash.me";

export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: "/login",
      });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { nostrConfig } = useAuth();
  const [coco, setCoco] = useState<Manager | null>(null);

  const npcClient = useMemo(() => {
    if (!nostrConfig) return null;
    return new NPCClient(
      NPC_BASE_URL,
      new JWTAuthProvider(NPC_BASE_URL, nostrConfig.signer),
    );
  }, [nostrConfig]);

  useEffect(() => {});

  useEffect(() => {
    if (!nostrConfig) return;

    let cancelled = false;

    initializeWallet(nostrConfig.pubkey, nostrConfig.signer).then((manager) => {
      if (!cancelled) {
        setCoco(manager);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [nostrConfig]);

  if (!coco || !npcClient) {
    return <div>Loading wallet...</div>;
  }

  return (
    <NPCProvider client={npcClient}>
      <CocoCashuProvider manager={coco}>
        <Outlet />
      </CocoCashuProvider>
    </NPCProvider>
  );
}
