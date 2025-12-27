import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { CocoCashuProvider } from "coco-cashu-react";
import { routeTree } from "./routeTree.gen";
import { coco } from "./lib/coco";

import "./index.css";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <CocoCashuProvider manager={coco}>
    <RouterProvider router={router} />
  </CocoCashuProvider>
);
