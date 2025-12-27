import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div>
      <p>Home</p>
      <Button asChild>
        <Link to="/about">About</Link>
      </Button>
    </div>
  );
}
