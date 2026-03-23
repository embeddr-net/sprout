/**
 * Shared types for sprout UI components.
 */

export type PluginComponentEntry = {
  pluginId: string;
  def: {
    id: string;
    label?: string;
    exportName?: string;
    location?: string;
    props?: Record<string, unknown>;
    defaultPosition?: { x: number; y: number };
    defaultSize?: { width: number; height: number };
  };
};

export const getEntryKey = (entry: PluginComponentEntry) =>
  `${entry.pluginId}:${entry.def.id}`;

/**
 * Collect PluginComponentEntry items from the plugin registry.
 */
export const collectPluginComponents = (
  plugins: Record<string, any>,
): PluginComponentEntry[] => {
  const all: PluginComponentEntry[] = [];
  Object.values(plugins || {}).forEach((plugin: any) => {
    (plugin.components || []).forEach((def: any) => {
      if (!def?.id) return;
      const location = String(def.location || "").toLowerCase();
      if (
        location !== "window" &&
        location !== "zen-overlay" &&
        location !== "page"
      )
        return;
      all.push({ pluginId: plugin.id, def });
    });
  });
  return all;
};

/**
 * Resolve a component ID (e.g. "myplugin-some-panel") to a plugin ID
 * and component name using the loaded plugin registry.
 */
export const resolvePluginComponent = (
  componentId: string,
  plugins: Record<string, any>,
): { pluginId: string; componentName: string; def?: any } | null => {
  const pluginIds = Object.keys(plugins || {});
  let bestMatch: string | null = null;
  for (const pid of pluginIds) {
    const prefix = `${pid}-`;
    if (componentId.startsWith(prefix)) {
      if (!bestMatch || pid.length > bestMatch.length) {
        bestMatch = pid;
      }
    }
  }
  if (!bestMatch) return null;

  const defId = componentId.slice(bestMatch.length + 1);
  const plugin = plugins[bestMatch];
  const def = (plugin?.components || []).find(
    (comp: any) => comp?.id === defId || comp?.exportName === defId,
  );
  const componentName = def?.exportName || def?.id || defId;
  return { pluginId: bestMatch, componentName, def };
};
