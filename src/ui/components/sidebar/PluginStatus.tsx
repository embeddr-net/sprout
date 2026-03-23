/**
 * PluginStatus – compact loaded plugins count with expandable list.
 */

import React from "react";
import { usePluginRegistry } from "@embeddr/zen-shell";
import { Badge, cn } from "@embeddr/react-ui";
import { Blocks, ChevronDown, ChevronRight } from "lucide-react";

export function PluginStatus() {
  const registry = usePluginRegistry();
  const pluginIds = Object.keys(registry.plugins || {});
  const [expanded, setExpanded] = React.useState(false);

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
        <Blocks className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        <span className="flex-1 text-muted-foreground">Plugins</span>
        <Badge
          variant="secondary"
          className="h-4 px-1.5 text-[10px] font-normal"
        >
          {pluginIds.length}
        </Badge>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        )}
      </button>

      {expanded && (
        <div className="ml-2 border-l border-border/40 pl-3 py-1 animate-in fade-in slide-in-from-top-1 duration-100">
          {pluginIds.length ? (
            <div className="flex flex-wrap gap-1">
              {pluginIds.map((id) => (
                <span
                  key={id}
                  className="rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {id}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground/60">
              No plugins loaded
            </div>
          )}
        </div>
      )}
    </div>
  );
}
