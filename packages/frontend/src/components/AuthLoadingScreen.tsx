import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X } from "lucide-react";

interface AuthLoadingScreenProps {
  onClearSession: () => void;
}

export function AuthLoadingScreen({ onClearSession }: AuthLoadingScreenProps) {
  // Show clear button after a delay to avoid flashing it on quick loads
  const [showClearButton, setShowClearButton] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowClearButton(true);
    }, 2000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/5 via-background to-background p-4">
      <div className="flex flex-col items-center gap-8">
        <h1 className="bg-gradient-to-r from-primary via-chart-3 to-chart-2 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
          npub.cash
        </h1>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center gap-4 px-8 py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Restoring session...
            </p>
          </CardContent>
        </Card>

        <div
          className={`transition-opacity duration-300 ${showClearButton ? "opacity-100" : "opacity-0"}`}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSession}
            className="gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
            Clear session
          </Button>
        </div>
      </div>
    </div>
  );
}
