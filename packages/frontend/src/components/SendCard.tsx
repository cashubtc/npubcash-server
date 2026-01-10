import { useState } from "react";
import { useMints, useSend } from "coco-cashu-react";
import { getEncodedToken } from "coco-cashu-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SendCard() {
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
