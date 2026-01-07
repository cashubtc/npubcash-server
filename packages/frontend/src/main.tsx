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

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}

function InnerApp() {
  const auth = useAuth();

  // Don't render router until session restoration is complete
  if (auth.isRestoring) {
    return <LoadingScreen />;
  }

  return <RouterProvider router={router} context={{ auth }} />;
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <InnerApp />
  </AuthProvider>
);
