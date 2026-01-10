import { useBalanceContext } from "coco-cashu-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function BalanceCard() {
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
