import { useState } from "react";
import { useMints } from "coco-cashu-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function MintsCard() {
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
