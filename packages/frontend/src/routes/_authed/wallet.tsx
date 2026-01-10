import { createFileRoute } from "@tanstack/react-router";
import { BalanceCard } from "@/components/BalanceCard";
import { AddressCard } from "@/components/AddressCard";
import { SendCard } from "@/components/SendCard";
import { MintsCard } from "@/components/MintsCard";
import { BuyUsernameCard } from "@/components/BuyUsernameCard";
import { HistoryCard } from "@/components/HistoryCard";

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
