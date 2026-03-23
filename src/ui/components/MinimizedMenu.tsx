/**
 * MinimizedMenu – dropdown for restoring minimized panels.
 */

import { useZenWindowStoreContext } from "@embeddr/zen-shell";
import { Badge } from "@embeddr/react-ui";
import { Button } from "@embeddr/react-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@embeddr/react-ui";

export const MinimizedMenu = () => {
  const windows = useZenWindowStoreContext((s) => s.windows);
  const restoreWindow = useZenWindowStoreContext((s) => s.restoreWindow);
  const setActiveTab = useZenWindowStoreContext((s) => s.setActiveTab);

  const minimized = Object.values(windows).filter((win) => win.isMinimized);

  const handleRestore = (id: string, hostId?: string | null) => {
    if (hostId) {
      restoreWindow(hostId);
      setActiveTab(hostId, id);
      return;
    }
    restoreWindow(id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-7 px-2 text-xs">
          Minimized
          <Badge variant="secondary" className="ml-2 h-4 px-1.5">
            {minimized.length}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {minimized.length ? (
          minimized.map((win) => (
            <DropdownMenuItem
              key={win.id}
              onSelect={() => handleRestore(win.id, win.groupHostId)}
            >
              {win.title || "Untitled"}
            </DropdownMenuItem>
          ))
        ) : (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No minimized panels
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
