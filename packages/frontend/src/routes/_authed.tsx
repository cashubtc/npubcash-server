import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { CocoCashuProvider } from "coco-cashu-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/hooks/useWallet";

export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { nostrConfig } = useAuth();
  const { manager, error, isLoading } = useWallet(nostrConfig);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading wallet...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">Failed to load wallet: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-primary underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!manager) {
    return null;
  }

  return (
    <CocoCashuProvider manager={manager}>
      <Outlet />
    </CocoCashuProvider>
  );
}
