import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { usePaginatedHistory } from "coco-cashu-react";
import type { HistoryEntry } from "coco-cashu-core";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authed/history")({
  component: History,
});

function formatHistoryEntry(entry: HistoryEntry): {
  label: string;
  amount: string;
  date: string;
  time: string;
} {
  const dateObj = new Date(entry.createdAt);
  const date = dateObj.toLocaleDateString();
  const time = dateObj.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  switch (entry.type) {
    case "mint":
      return { label: "Mint", amount: `+${entry.amount}`, date, time };
    case "melt":
      return { label: "Melt", amount: `-${entry.amount}`, date, time };
    case "send":
      return { label: "Send", amount: `-${entry.amount}`, date, time };
    case "receive":
      return { label: "Receive", amount: `+${entry.amount}`, date, time };
  }
}

function History() {
  const [page, setPage] = useState(0);
  const { history, hasMore, isFetching, goToPage } = usePaginatedHistory(25);

  const handlePrevPage = async () => {
    if (page > 0) {
      const newPage = page - 1;
      await goToPage(newPage);
      setPage(newPage);
    }
  };

  const handleNextPage = async () => {
    if (hasMore) {
      const newPage = page + 1;
      await goToPage(newPage);
      setPage(newPage);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <Button render={<Link to="/wallet" />} variant="outline" size="sm">
          Back to Wallet
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>Page {page + 1}</CardDescription>
        </CardHeader>
        <CardContent>
          {isFetching && history.length === 0 ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-muted-foreground text-sm">No transactions yet</p>
          ) : (
            <ul className="space-y-2">
              {history.map((entry) => {
                const { label, amount, date, time } = formatHistoryEntry(entry);
                return (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between rounded bg-muted p-3"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-muted-foreground text-xs">
                        {date} at {time}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {new URL(entry.mintUrl).hostname}
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
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevPage}
          disabled={page === 0 || isFetching}
        >
          Previous
        </Button>
        <span className="text-muted-foreground text-sm">Page {page + 1}</span>
        <Button
          variant="outline"
          onClick={handleNextPage}
          disabled={!hasMore || isFetching}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
