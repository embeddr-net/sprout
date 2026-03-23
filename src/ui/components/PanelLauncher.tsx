/**
 * Panel launcher for spawning plugin components as draggable panels or tiles.
 */

import React from "react";
import { useZenWindowStoreContext, setTileDragData } from "@embeddr/zen-shell";
import { Badge } from "@embeddr/react-ui";
import { Button } from "@embeddr/react-ui";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@embeddr/react-ui";
import type { PluginComponentEntry } from "./types";
import { getEntryKey } from "./types";

export const PanelLauncher = ({
  components,
  pluginLogos,
}: {
  components: PluginComponentEntry[];
  pluginLogos: Record<string, string | null>;
}) => {
  const spawnWindow = useZenWindowStoreContext((s) => s.spawnWindow);
  const updateWindow = useZenWindowStoreContext((s) => s.updateWindow);

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    entry: PluginComponentEntry,
  ) => {
    setTileDragData(event, {
      entryKey: getEntryKey(entry),
    });
  };

  const handleSpawn = (entry: PluginComponentEntry) => {
    const componentId = `${entry.pluginId}-${entry.def.id}`;
    const windowId = spawnWindow(
      componentId,
      entry.def.label || entry.def.id,
      entry.def.props,
    );
    if (entry.def.defaultPosition || entry.def.defaultSize) {
      updateWindow(windowId, {
        position: entry.def.defaultPosition,
        size: entry.def.defaultSize,
      });
    }
  };

  const grouped = React.useMemo(() => {
    const map = new Map<string, PluginComponentEntry[]>();
    components.forEach((entry) => {
      const list = map.get(entry.pluginId) || [];
      list.push(entry);
      map.set(entry.pluginId, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [components]);

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Plugin Panels
        </div>
        <Badge variant="secondary" className="h-4 px-1.5">
          {components.length}
        </Badge>
      </div>
      <Accordion type="multiple" className="max-h-56 overflow-auto">
        {grouped.map(([pluginId, entries]) => (
          <AccordionItem key={pluginId} value={pluginId}>
            <AccordionTrigger className="py-2 text-xs">
              <span className="flex items-center gap-2 truncate">
                {pluginLogos[pluginId] ? (
                  <img
                    src={pluginLogos[pluginId] || ""}
                    alt=""
                    className="h-4 w-4 rounded-sm object-contain"
                  />
                ) : null}
                {pluginId}
              </span>
              <Badge variant="secondary" className="h-4 px-1.5">
                {entries.length}
              </Badge>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div
                    key={`${entry.pluginId}-${entry.def.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2 py-1 cursor-grab"
                    draggable
                    onDragStart={(e) => handleDragStart(e, entry)}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      {pluginLogos[entry.pluginId] ? (
                        <img
                          src={pluginLogos[entry.pluginId] || ""}
                          alt=""
                          className="h-5 w-5 rounded-sm object-contain"
                        />
                      ) : null}
                      <div>
                        <div className="font-medium">
                          {entry.def.label || entry.def.id}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {entry.def.id}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleSpawn(entry)}
                      className="h-7 px-2 text-xs"
                    >
                      Open
                    </Button>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
