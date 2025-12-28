import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { CocoCashuProvider } from "coco-cashu-react";
import { coco } from "@/lib/coco";

export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: "/login",
      });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <CocoCashuProvider manager={coco}>
      <Outlet />
    </CocoCashuProvider>
  );
}