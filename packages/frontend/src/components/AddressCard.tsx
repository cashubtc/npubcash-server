import { useState } from "react";
import { npubEncode } from "nostr-tools/nip19";
import { useNpcInfo } from "@/hooks/useNpcInfo";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AddressCard() {
  const { info, loading } = useNpcInfo();
  console.log(info);
  const [copied, setCopied] = useState(false);

  const hostnameEnv = import.meta.env.NPC_HOSTNAME || "https://npub.cash";
  const hostname = new URL(hostnameEnv).hostname;
  const identifier =
    info?.name ?? (info?.pubkey ? npubEncode(info.pubkey) : null);
  const address = identifier ? `${identifier}@${hostname}` : null;

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Address</CardTitle>
        <CardDescription>
          Your Lightning address for receiving payments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <p className="break-all rounded bg-muted p-2 font-mono text-sm">
            {address}
          </p>
        )}
        <Button
          onClick={handleCopy}
          variant="outline"
          disabled={loading || !address}
        >
          {copied ? "Copied!" : "Copy Address"}
        </Button>
      </CardContent>
    </Card>
  );
}
