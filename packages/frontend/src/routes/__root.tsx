import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"
import { NavBar } from "@/components/NavBar"
import type { AuthContextType } from "@/contexts/AuthContext"

interface RouterContext {
  auth: AuthContextType
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-4xl p-4">
        <Outlet />
      </main>
    </div>
  )
}
