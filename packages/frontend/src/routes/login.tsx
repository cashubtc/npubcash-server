import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({
        to: "/wallet",
      });
    }
  },
  component: Login,
});

function Login() {
  const {
    login,
    loginWithNip46,
    cancelNip46Login,
    nip46State,
    nip46Error,
    isLoading,
  } = useAuth();
  const router = useRouter();
  const [nostrConnectURI, setNostrConnectURI] = useState<string | null>(null);
  const [extensionError, setExtensionError] = useState<string | null>(null);

  useEffect(() => {
    router.invalidate();
  });

  const handleExtensionLogin = async () => {
    setExtensionError(null);
    try {
      await login();
    } catch (e) {
      setExtensionError(e instanceof Error ? e.message : "Extension login failed");
    }
  };

  const handleNip46Login = () => {
    setExtensionError(null);
    const uri = loginWithNip46();
    setNostrConnectURI(uri);
  };

  const handleCancelNip46 = () => {
    cancelNip46Login();
    setNostrConnectURI(null);
  };

  const copyToClipboard = async () => {
    if (nostrConnectURI) {
      await navigator.clipboard.writeText(nostrConnectURI);
    }
  };

  // Combine errors for display
  const error = extensionError || nip46Error;

  // Show waiting state for NIP-46 connection
  if (nip46State === "awaiting" && nostrConnectURI) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
        <h2 className="text-xl font-semibold">Connect with Remote Signer</h2>
        <p className="max-w-md text-center text-muted-foreground">
          Scan this QR code or copy the connection string to your remote signer
          (bunker) app.
        </p>

        <div className="flex flex-col items-center gap-4 rounded-lg border bg-card p-6">
          <div className="rounded-lg bg-white p-3">
            <QRCode value={nostrConnectURI} size={200} />
          </div>
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            Copy Connection String
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Waiting for connection...
        </p>

        <Button variant="ghost" onClick={handleCancelNip46}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
      <h2 className="text-xl font-semibold">Login to npub.cash</h2>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex flex-col gap-4">
        <Button size="lg" onClick={handleExtensionLogin} disabled={isLoading}>
          Login With Extension
        </Button>

        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-sm text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          size="lg"
          variant="outline"
          onClick={handleNip46Login}
          disabled={isLoading}
        >
          Login With Remote Signer
        </Button>
      </div>

      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Use a browser extension like nos2x or Alby, or connect to a remote
        signer like nsec.app or Amber.
      </p>
    </div>
  );
}
