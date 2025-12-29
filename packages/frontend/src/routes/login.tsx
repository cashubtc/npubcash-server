import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({
        to: "/",
      });
    }
  },
  component: Login,
});

function Login() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  useEffect(() => {
    router.invalidate();
  });

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Button
        size="lg"
        onClick={async () => {
          await login();
          await new Promise((res) => setTimeout(res, 1000));
          console.log(isAuthenticated);
        }}
      >
        Login With Extension
      </Button>
    </div>
  );
}
