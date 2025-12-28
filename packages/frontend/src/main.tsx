import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

import "./index.css";

const router = createRouter({
  routeTree,
  context: {
    auth: undefined!, // Will be set by InnerApp
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function InnerApp() {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth }} />;
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <InnerApp />
  </AuthProvider>
);
