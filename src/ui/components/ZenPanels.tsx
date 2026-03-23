/**
 * ZenPanels – renders plugin components inside the ZenPanelManager.
 */

import React from "react";
import {
  DynamicPluginComponent,
  ZenPanelManager,
  usePluginRegistry,
} from "@embeddr/zen-shell";
import type { EmbeddrAPI } from "@embeddr/zen-shell";
import { resolvePluginComponent } from "./types";

export const ZenPanels = ({
  api,
  getPluginApi,
}: {
  api: EmbeddrAPI;
  getPluginApi: (pluginId: string) => EmbeddrAPI;
}) => {
  const registry = usePluginRegistry();

  const renderContent = React.useCallback(
    (windowState: {
      id: string;
      componentId: string;
      props?: Record<string, unknown>;
    }) => {
      const resolved = resolvePluginComponent(
        windowState.componentId,
        registry.plugins,
      );
      if (!resolved) {
        return (
          <div className="p-4 text-xs text-muted-foreground">
            Unknown panel: {windowState.componentId}
          </div>
        );
      }
      const pluginApi = getPluginApi(resolved.pluginId) || api;
      return (
        <DynamicPluginComponent
          pluginId={resolved.pluginId}
          componentName={resolved.componentName}
          api={pluginApi}
          windowId={windowState.id}
          id={windowState.id}
          {...(resolved.def?.props || {})}
          {...(windowState.props || {})}
        />
      );
    },
    [api, getPluginApi, registry.plugins],
  );

  return <ZenPanelManager renderContent={renderContent} />;
};
