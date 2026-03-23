/**
 * MinimizedPanelsList – sidebar section listing minimized floating panels.
 * Click to restore. Appears only when there are minimized panels.
 */

import { useZenWindowStoreContext } from "@embeddr/zen-shell";
import { cn } from "@embeddr/react-ui";
import { Minimize2, RotateCcw } from "lucide-react";

export function MinimizedPanelsList() {
  const windows = useZenWindowStoreContext((s) => s.windows);
  const restoreWindow = useZenWindowStoreContext((s) => s.restoreWindow);
  const setActiveTab = useZenWindowStoreContext((s) => s.setActiveTab);

  const minimized = Object.values(windows).filter((win) => win.isMinimized);

  if (minimized.length === 0) return null;

  const handleRestore = (id: string, hostId?: string | null) => {
    if (hostId) {
      restoreWindow(hostId);
      setActiveTab(hostId, id);
      return;
    }
    restoreWindow(id);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-1">
        <Minimize2 className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[11px] font-medium text-muted-foreground">
          Minimized ({minimized.length})
        </span>
      </div>

      <div className="space-y-0.5">
        {minimized.map((win) => (
          <button
            key={win.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5",
              "text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              "transition-colors text-left",
            )}
            onClick={() => handleRestore(win.id, win.groupHostId)}
          >
            <RotateCcw className="h-3 w-3 shrink-0 opacity-50" />
            <span
              className="min-w-0 flex-1 max-w-42.5 truncate"
              title={win.title || "Untitled"}
            >
              {win.title || "Untitled"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
