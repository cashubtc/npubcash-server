import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/")({
  component: Home,
});

function Home() {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    await router.invalidate();
  };

  return (
    <div>
      <p>Home (Authenticated)</p>
      <div className="flex gap-2">
        <Button asChild>
          <Link to="/about">About</Link>
        </Button>
        <Button variant="outline" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </div>
  );
}