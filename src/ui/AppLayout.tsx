/**
 * AppLayout – full-bleed content area.
 * All controls (minimized panels, dev tools, sidebar toggle) live in the sidebar.
 */

import { Outlet } from "@tanstack/react-router";

export function AppLayout() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background text-foreground">
      <Outlet />
    </main>
  );
}
