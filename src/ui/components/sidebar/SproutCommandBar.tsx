/**
 * SproutCommandBar – searchable plugin launcher with drag-and-drop.
 *
 * Inspired by LotusFinder / ControlPanelPanel — lets you quickly filter
 * through available plugins, open them as floating panels, or drag them
 * into the tiling layout.
 */

import React from "react";
import { useZenWindowStoreContext, setTileDragData } from "@embeddr/zen-shell";
import { Badge, Button, Input, cn } from "@embeddr/react-ui";
import { ScrollArea } from "@embeddr/react-ui";
import { Search, GripVertical, ExternalLink } from "lucide-react";
import type { PluginComponentEntry } from "../types";
import { getEntryKey } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(s: string) {
  return (s || "").toLowerCase().trim();
}

function matchEntry(entry: PluginComponentEntry, query: string): number {
  const q = normalize(query);
  if (!q) return 1; // show everything when no filter
  const label = normalize(entry.def.label || entry.def.id);
  const plugin = normalize(entry.pluginId);

  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.includes(q)) return 60;
  if (plugin.includes(q)) return 40;
  return 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface SproutCommandBarProps {
  components: PluginComponentEntry[];
  pluginLogos: Record<string, string | null>;
}

export function SproutCommandBar({
  components,
  pluginLogos,
}: SproutCommandBarProps) {
  const spawnWindow = useZenWindowStoreContext((s) => s.spawnWindow);
  const updateWindow = useZenWindowStoreContext((s) => s.updateWindow);
  const [filter, setFilter] = React.useState("");

  const filtered = React.useMemo(() => {
    return components
      .map((c) => ({ entry: c, score: matchEntry(c, filter) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [components, filter]);

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

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    entry: PluginComponentEntry,
  ) => {
    setTileDragData(event, { entryKey: getEntryKey(entry) });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Panels
        </span>
        <Badge
          variant="secondary"
          className="h-4 px-1.5 text-[10px] font-normal"
        >
          {filtered.length}
        </Badge>
      </div>

      {/* Search */}
      <div className="relative shrink-0">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search panels..."
          className="h-8 pl-7 text-xs bg-muted/30 border-border/40"
        />
      </div>

      {/* Results – fills remaining sidebar space */}
      <ScrollArea className="min-h-0 flex-1" type="always">
        <div className="space-y-1 pr-3">
          {filtered.map(({ entry }) => {
            const logo = pluginLogos[entry.pluginId];
            const entryLocation = String(
              entry.def.location || "",
            ).toLowerCase();
            const entryKind = entryLocation === "page" ? "Page" : "Panel";
            return (
              <div
                key={`${entry.pluginId}-${entry.def.id}`}
                className={cn(
                  "group grid w-full max-w-full grid-cols-[14px_20px_minmax(0,1fr)_24px] items-center gap-2 rounded-lg px-2 py-1.5 pr-3 overflow-hidden",
                  "cursor-grab border border-transparent",
                  "hover:border-border/50 hover:bg-muted/40",
                  "transition-colors duration-100",
                )}
                draggable
                onDragStart={(e) => handleDragStart(e, entry)}
              >
                {/* Drag grip */}
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60" />

                {/* Logo */}
                {logo ? (
                  <img
                    src={logo}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-sm object-contain"
                  />
                ) : (
                  <div className="h-5 w-5 shrink-0 rounded-sm bg-muted/50" />
                )}

                {/* Label + plugin */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="min-w-0 flex-1 max-w-37.5 text-xs font-medium truncate"
                      title={entry.def.label || entry.def.id}
                    >
                      {entry.def.label || entry.def.id}
                    </div>
                    <Badge
                      variant="secondary"
                      className="h-4 shrink-0 px-1 text-[9px] font-normal"
                    >
                      {entryKind}
                    </Badge>
                  </div>
                  <div
                    className="text-[10px] text-muted-foreground/70 truncate"
                    title={entry.pluginId}
                  >
                    {entry.pluginId}
                  </div>
                </div>

                {/* Open button */}
                <button
                  type="button"
                  className={cn(
                    "shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/60",
                    "bg-background/70 text-foreground/80 hover:bg-muted/70",
                    "opacity-100",
                  )}
                  title="Open as floating panel"
                  aria-label="Open as floating panel"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSpawn(entry);
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-4 text-center text-xs text-muted-foreground/60">
              No panels match "{filter}"
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
