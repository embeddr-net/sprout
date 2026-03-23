/**
 * OpenPanelsList – compact list of open floating panels, draggable into tiles.
 */

import React from "react";
import { setTileDragData, useZenWindowStoreContext } from "@embeddr/zen-shell";
import { Badge, cn } from "@embeddr/react-ui";
import { ScrollArea } from "@embeddr/react-ui";
import {
  AppWindow,
  GripVertical,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import type { PluginComponentEntry } from "../types";
import { getEntryKey } from "../types";

interface OpenPanelEntry {
  windowId: string;
  title: string;
  entry: PluginComponentEntry;
}

interface OpenPanelsListProps {
  entries: OpenPanelEntry[];
}

export function OpenPanelsList({ entries }: OpenPanelsListProps) {
  const [expanded, setExpanded] = React.useState(true);
  const closeWindow = useZenWindowStoreContext((s) => s.closeWindow);
  const setActiveTab = useZenWindowStoreContext((s) => s.setActiveTab);

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    entry: PluginComponentEntry,
    windowId: string,
  ) => {
    setTileDragData(event, {
      entryKey: getEntryKey(entry),
      instanceId: windowId,
    });
  };

  const handleFocus = (windowId: string) => {
    try {
      setActiveTab(windowId, windowId);
    } catch {
      // ignore if not tabbable
    }
  };

  if (entries.length === 0) return null;

  return (
    <div className="space-y-1">
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5",
          "text-left text-xs transition-colors",
          "hover:bg-muted/40",
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        <AppWindow className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        <span className="flex-1 text-muted-foreground">Floating</span>
        <Badge
          variant="secondary"
          className="h-4 px-1.5 text-[10px] font-normal"
        >
          {entries.length}
        </Badge>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        )}
      </button>

      {expanded && (
        <ScrollArea className="max-h-[30vh]">
          <div className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-100">
            {entries.map((e) => (
              <div
                key={e.windowId}
                className={cn(
                  "group flex w-full max-w-full items-center gap-2 rounded-lg px-2 py-1 overflow-hidden",
                  "cursor-grab text-xs",
                  "hover:bg-muted/40 transition-colors",
                )}
                draggable
                onDragStart={(event) =>
                  handleDragStart(event, e.entry, e.windowId)
                }
                onClick={() => handleFocus(e.windowId)}
              >
                <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
                <span
                  className="min-w-0 flex-1 max-w-35 truncate font-medium"
                  title={e.entry.def.label || e.entry.def.id}
                >
                  {e.entry.def.label || e.entry.def.id}
                </span>
                <span
                  className="text-[10px] text-muted-foreground/50 truncate max-w-18"
                  title={e.entry.pluginId}
                >
                  {e.entry.pluginId}
                </span>
                <button
                  type="button"
                  className={cn(
                    "shrink-0 rounded p-0.5",
                    "text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10",
                    "opacity-0 group-hover:opacity-100 transition-opacity",
                  )}
                  title="Close panel"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    closeWindow(e.windowId);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
