import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useBalanceContext,
  useManager,
  useSend,
  useMints,
  usePaginatedHistory,
} from "coco-cashu-react";
import type { HistoryEntry } from "coco-cashu-core";
import { getEncodedToken } from "coco-cashu-core";
import { npubEncode } from "nostr-tools/nip19";
import { useNpcInfo } from "@/hooks/useNpcInfo";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authed/wallet")({
  component: Wallet,
});

function Wallet() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Wallet</h1>
      <BalanceCard />
      <AddressCard />
      <div className="grid gap-6 md:grid-cols-2">
        <SendCard />
        <MintsCard />
      </div>
      <BuyUsernameCard />
      <HistoryCard />
    </div>
  );
}

function BalanceCard() {
  const { balance } = useBalanceContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance</CardTitle>
        <CardDescription>Your total balance across all mints</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold">{balance.total} sats</p>
        {Object.entries(balance)
          .filter(([key]) => key !== "total")
          .map(([mintUrl, amount]) => (
            <p key={mintUrl} className="text-muted-foreground mt-2 text-sm">
              {new URL(mintUrl).hostname}: {amount} sats
            </p>
          ))}
      </CardContent>
    </Card>
  );
}

function AddressCard() {
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

function SendCard() {
  const [amount, setAmount] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const { mints } = useMints();
  const { prepareSend, executePreparedSend, isSending, error, reset } =
    useSend();

  const handleSend = async () => {
    const amountNum = parseInt(amount, 10);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const mintUrl = mints[0]?.mintUrl;
    if (!mintUrl) return;

    const prepared = await prepareSend(mintUrl, amountNum);
    await executePreparedSend(prepared.id, {
      onSuccess: ({ token }) => {
        setGeneratedToken(getEncodedToken(token));
        setAmount("");
      },
    });
  };

  const handleCopy = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
    }
  };

  const handleReset = () => {
    setGeneratedToken(null);
    reset();
  };

  if (generatedToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Send</CardTitle>
          <CardDescription>Token generated</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="break-all rounded bg-muted p-2 font-mono text-xs">
            {generatedToken}
          </p>
          <div className="flex gap-2">
            <Button onClick={handleCopy}>Copy</Button>
            <Button variant="outline" onClick={handleReset}>
              New
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send</CardTitle>
        <CardDescription>Create a Cashu token to send</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="number"
          placeholder="Amount in sats"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button
          onClick={handleSend}
          disabled={isSending || !amount || mints.length === 0}
        >
          {isSending ? "Creating..." : "Create Token"}
        </Button>
        {error && <p className="text-destructive text-sm">{error.message}</p>}
        {mints.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Add a mint first to send tokens
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MintsCard() {
  const [mintUrl, setMintUrl] = useState("");
  const { mints, addNewMint } = useMints();
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddMint = async () => {
    if (!mintUrl.trim()) return;
    setIsAdding(true);
    setError(null);
    try {
      await addNewMint(mintUrl, { trusted: true });
      setMintUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add mint");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mints</CardTitle>
        <CardDescription>Manage your connected mints</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mints.length === 0 ? (
          <p className="text-muted-foreground text-sm">No mints added yet</p>
        ) : (
          <ul className="space-y-2">
            {mints.map((mint) => (
              <li
                key={mint.mintUrl}
                className="flex items-center justify-between rounded bg-muted p-2"
              >
                <span className="text-sm">
                  {new URL(mint.mintUrl).hostname}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            placeholder="https://mint.example.com"
            value={mintUrl}
            onChange={(e) => setMintUrl(e.target.value)}
          />
          <Button
            onClick={handleAddMint}
            disabled={isAdding || !mintUrl.trim()}
          >
            {isAdding ? "Adding..." : "Add"}
          </Button>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}

type PendingPurchase = {
  username: string;
  amount: number;
  acceptHandler: () => Promise<void>;
};

function BuyUsernameCard() {
  const [username, setUsername] = useState("");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase | null>(null);
  const manager = useManager();
  const { info, refetch } = useNpcInfo();

  const handlePurchase = async () => {
    if (!username.trim()) return;
    setIsPurchasing(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await manager.ext.npc.setUsername(username.trim());
      if (!result.success) {
        setPendingPurchase({
          username: username.trim(),
          amount: result.pr.amount ?? 0,
          acceptHandler: result.acceptHandler,
        });
      } else {
        setSuccess(true);
        setUsername("");
        await refetch();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to purchase username");
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingPurchase) return;
    setIsConfirming(true);
    setError(null);
    try {
      await pendingPurchase.acceptHandler();
      setSuccess(true);
      setUsername("");
      setPendingPurchase(null);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm purchase");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    setPendingPurchase(null);
    setError(null);
  };

  if (info?.name) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Username</CardTitle>
          <CardDescription>Your registered username</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="break-all rounded bg-muted p-2 font-mono text-sm">
            {info.name}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (pendingPurchase) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Confirm Purchase</CardTitle>
          <CardDescription>
            Review your username purchase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded bg-muted p-4 space-y-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Username:</span>{" "}
              <span className="font-mono font-medium">{pendingPurchase.username}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Cost:</span>{" "}
              <span className="font-medium">{pendingPurchase.amount.toLocaleString()} sats</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleConfirm}
              disabled={isConfirming}
            >
              {isConfirming ? "Confirming..." : "Confirm Purchase"}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isConfirming}
            >
              Cancel
            </Button>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buy Username</CardTitle>
        <CardDescription>
          Register a username
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Enter username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Button
          onClick={handlePurchase}
          disabled={isPurchasing || !username.trim()}
        >
          {isPurchasing ? "Checking..." : "Buy Username"}
        </Button>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {success && (
          <p className="text-sm text-green-600">Username purchased!</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatHistoryEntry(entry: HistoryEntry): {
  label: string;
  amount: string;
  date: string;
} {
  const date = new Date(entry.createdAt).toLocaleDateString();
  switch (entry.type) {
    case "mint":
      return { label: "Mint", amount: `+${entry.amount}`, date };
    case "melt":
      return { label: "Melt", amount: `-${entry.amount}`, date };
    case "send":
      return { label: "Send", amount: `-${entry.amount}`, date };
    case "receive":
      return { label: "Receive", amount: `+${entry.amount}`, date };
  }
}

function HistoryCard() {
  const { history, isFetching } = usePaginatedHistory(5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your latest transactions</CardDescription>
      </CardHeader>
      <CardContent>
        {isFetching && history.length === 0 ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : history.length === 0 ? (
          <p className="text-muted-foreground text-sm">No transactions yet</p>
        ) : (
          <ul className="space-y-2">
            {history.map((entry) => {
              const { label, amount, date } = formatHistoryEntry(entry);
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded bg-muted p-2"
                >
                  <div>
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {date}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-medium ${amount.startsWith("+") ? "text-green-600" : "text-red-600"}`}
                  >
                    {amount} sats
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline" size="sm">
          <Link to="/history">View All</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
