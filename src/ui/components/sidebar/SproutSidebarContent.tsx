/**
 * SproutSidebarContent – composed sidebar sections.
 *
 * Assembles: open panels and command bar (panel search)
 * into a coherent control panel. Connection/auth/theme/pin live
 * in the SproutUserPanel at the bottom of the sidebar.
 */

import React from "react";
import { Separator } from "@embeddr/react-ui";
import { ScrollArea } from "@embeddr/react-ui";
import { OpenPanelsList } from "./OpenPanelsList";
import { MinimizedPanelsList } from "./MinimizedPanelsList";
import { SproutCommandBar } from "./SproutCommandBar";
import type { PluginComponentEntry } from "../types";

interface OpenPanelEntry {
  windowId: string;
  title: string;
  entry: PluginComponentEntry;
}

interface SproutSidebarContentProps {
  components: PluginComponentEntry[];
  pluginLogos: Record<string, string | null>;
  openWindowEntries: OpenPanelEntry[];
}

export function SproutSidebarContent({
  components,
  pluginLogos,
  openWindowEntries,
}: SproutSidebarContentProps) {
  return (
    <div className="flex flex-1 min-h-0 flex-col gap-2 p-3">
      {/* Status / info sections – scrollable when expanded, capped at 40% */}
      <ScrollArea className="shrink-0 max-h-[40%]">
        <div className="space-y-1.5">
          <OpenPanelsList entries={openWindowEntries} />

          <MinimizedPanelsList />
        </div>
      </ScrollArea>

      <Separator className="opacity-40 shrink-0" />

      {/* Panel search & launch – fills remaining space */}
      <div className="flex min-h-0 flex-1 flex-col">
        <SproutCommandBar components={components} pluginLogos={pluginLogos} />
      </div>
    </div>
  );
}
