/**
 * OpenWindows – shows a list of currently open panels that can be dragged.
 */

import React from "react";
import { setTileDragData } from "@embeddr/zen-shell";
import type { PluginComponentEntry } from "./types";
import { getEntryKey } from "./types";

export const OpenWindows = ({
  entries,
}: {
  entries: Array<{
    windowId: string;
    title: string;
    entry: PluginComponentEntry;
  }>;
}) => {
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

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Open Panels
      </div>
      <div className="text-xs text-muted-foreground">
        {entries.length}
        {entries.length === 1 ? " panel" : " panels"}
      </div>
      <div className="space-y-2 max-h-40 overflow-auto">
        {entries.map((entry) => (
          <div
            key={entry.windowId}
            className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2 py-1 cursor-grab"
            draggable
            onDragStart={(event) =>
              handleDragStart(event, entry.entry, entry.windowId)
            }
          >
            <div className="text-xs">
              <div className="font-medium">{entry.title}</div>
              <div className="text-[11px] text-muted-foreground">
                {entry.entry.pluginId}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
