import { Link } from "@tanstack/react-router";
import { usePaginatedHistory } from "coco-cashu-react";
import type { HistoryEntry } from "coco-cashu-core";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

export function HistoryCard() {
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
      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button render={<Link to="/history" />} variant="outline" size="sm">
          View All
        </Button>
        <Button render={<Link to="/payments" />} variant="outline" size="sm">
          View Payments Chart
        </Button>
      </CardFooter>
    </Card>
  );
}
