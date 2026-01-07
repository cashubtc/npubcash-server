import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/")({
  beforeLoad: () => {
    throw redirect({
      to: "/wallet",
    });
  },
  component: () => null,
});