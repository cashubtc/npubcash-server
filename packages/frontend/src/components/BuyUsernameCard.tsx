import { useState } from "react";
import { useManager } from "coco-cashu-react";
import { useNpcInfo } from "@/hooks/useNpcInfo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PendingPurchase = {
  username: string;
  amount: number;
  acceptHandler: () => Promise<void>;
};

export function BuyUsernameCard() {
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
