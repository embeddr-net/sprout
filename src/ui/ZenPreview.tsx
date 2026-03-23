/**
 * ZenPreview – the main sprout shell view.
 *
 * Refactored to use:
 * - createEmbeddrAPI / createPluginScopedAPI from zen-shell (replaces ~300 lines of useSproutEmbeddrApi)
 * - ZenWebSocketProvider (replaces ~30 lines of inline WebSocket)
 * - Extracted components (PluginLoader, SproutSidebar, etc.)
 */

import React from "react";
import {
  ZenShell,
  usePluginRegistry,
  useLocalStorage,
  useTheme,
  useZenWindowStoreContext,
  useZenStores,
  EmbeddrProvider,
  CoreUIEventBridge,
  ZenWebSocketProvider,
  createEmbeddrAPI,
  createPluginScopedAPI,
  collapseEmptyNodes,
  createLeaf,
  createNodeId,
  findNodeById,
  getTileDragData,
  isTileDrag,
  pruneTreeEntries,
  updateNodeById,
} from "@embeddr/zen-shell";
import type {
  EmbeddrAPI,
  TileDragPayload,
  TileDropZone,
  TileNode,
} from "@embeddr/zen-shell";
import { createEmbeddrClient } from "@embeddr/client-typescript";
import {
  applyThemePackCss,
  applyThemePackTokens,
  type ThemePack,
} from "@/lib/api/themes";

// Extracted components
import {
  type PluginComponentEntry,
  getEntryKey,
  collectPluginComponents,
  resolvePluginComponent,
} from "./components/types";
import { ZenPanels } from "./components/ZenPanels";
import { SproutTilingLayout } from "./components/SproutTilingLayout";
import {
  SproutSidebar,
  SproutSidebarContent,
  SproutUserPanel,
} from "./components/sidebar";
import { useAutoConnect } from "./hooks/useAutoConnect";

// ---------------------------------------------------------------------------
// ZenShellBody – main layout and state management
// ---------------------------------------------------------------------------

const ZenShellBody = ({
  backendUrl,
  apiKey,
  setBackendUrl,
  setApiKey,
}: {
  backendUrl: string;
  apiKey: string;
  setBackendUrl: (value: string) => void;
  setApiKey: (value: string) => void;
}) => {
  const { theme } = useTheme();
  const registry = usePluginRegistry();

  // Raw Zustand store for imperative (non-reactive) window lookups
  const { windowStore: zenWindowStore } = useZenStores();

  // Use stable store reference for imperative calls (no subscription re-renders)
  const windowStoreRef = React.useRef<{
    openWindow: (wm: {
      id: string;
      title: string;
      componentId: string;
      props?: any;
    }) => void;
    spawnWindow: (componentId: string, title: string, props?: any) => string;
    getWindows: () => Record<string, any>;
    getState: () => any;
    list: () => Array<any>;
  }>(null!);

  // Subscribe to store functions once; these are stable refs in Zustand
  const openWindow = useZenWindowStoreContext((s) => s.openWindow);
  const spawnWindow = useZenWindowStoreContext((s) => s.spawnWindow);
  const closeWindow = useZenWindowStoreContext((s) => s.closeWindow);

  // Keep ref updated (no-op on stable refs, but safe)
  windowStoreRef.current = {
    openWindow,
    spawnWindow,
    getWindows: () => zenWindowStore.getState().windows,
    getState: () => zenWindowStore.getState(),
    list: () => Object.values(zenWindowStore.getState().windows),
  };

  // --- API via shared factory (stable: only depends on backendUrl/apiKey) ---
  const api: EmbeddrAPI = React.useMemo(
    () =>
      createEmbeddrAPI({
        backendUrl,
        apiKey,
        settingsPrefix: "sprout",
        windows: {
          open: (id, title, componentId, props) =>
            windowStoreRef.current.openWindow({
              id,
              title,
              componentId,
              props,
            }),
          spawn: (componentId, title, props) =>
            windowStoreRef.current.spawnWindow(componentId, title, props),
          getState: () => windowStoreRef.current.getState(),
          list: () => windowStoreRef.current.list(),
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [backendUrl, apiKey],
  );

  // --- Auto-connect & plugin loading (runs at app level, not in sidebar) ---
  const autoConnect = useAutoConnect(api, backendUrl, apiKey, setApiKey);

  // --- Cached plugin API factory: same pluginId → same object reference ---
  const pluginApiCacheRef = React.useRef(new Map<string, EmbeddrAPI>());
  // Invalidate cache when base api changes
  const apiVersionRef = React.useRef(api);
  if (apiVersionRef.current !== api) {
    apiVersionRef.current = api;
    pluginApiCacheRef.current.clear();
  }

  const getPluginApi = React.useCallback(
    (pluginId: string): EmbeddrAPI => {
      if (!pluginId) return api;
      const cached = pluginApiCacheRef.current.get(pluginId);
      if (cached) return cached;
      const scoped = createPluginScopedAPI(api, pluginId, {
        backendUrl,
        apiKey,
      });
      pluginApiCacheRef.current.set(pluginId, scoped);
      return scoped;
    },
    [api, backendUrl, apiKey],
  );

  // --- Local state ---
  const [showControls, setShowControls] = useLocalStorage(
    "sprout-show-controls",
    true,
  );
  const [tileTree, setTileTree] = useLocalStorage<TileNode | null>(
    "sprout-tiling-tree",
    null,
  );
  const [themePackId, setThemePackId] = useLocalStorage(
    "sprout-theme-pack",
    "",
  );
  const [themePacks, setThemePacks] = React.useState<ThemePack[]>([]);
  const [pluginLogos, setPluginLogos] = React.useState<
    Record<string, string | null>
  >({});
  const [canvasPreview, setCanvasPreview] = React.useState(false);

  // --- Lotus client for theme packs ---
  const lotusApi = React.useMemo(
    () => createEmbeddrClient({ backendUrl, apiKey, apiBasePath: "/api" }),
    [backendUrl, apiKey],
  );

  const refreshThemePacks = React.useCallback(async () => {
    try {
      const packs = await lotusApi.listThemePacks();
      setThemePacks(packs);
    } catch {
      setThemePacks([]);
    }
  }, [lotusApi]);

  React.useEffect(() => {
    if (backendUrl) refreshThemePacks();
  }, [backendUrl, refreshThemePacks]);

  // --- Plugin logos ---
  React.useEffect(() => {
    let active = true;
    const loadLogos = async () => {
      if (!api.plugins.listLogos) return;
      try {
        const logos = await api.plugins.listLogos();
        if (active) setPluginLogos(logos || {});
      } catch {
        if (active) setPluginLogos({});
      }
    };
    if (backendUrl) loadLogos();
    return () => {
      active = false;
    };
  }, [api, backendUrl]);

  // --- Theme pack application ---
  React.useEffect(() => {
    const activePack = themePacks.find((p) => p.id === themePackId);
    applyThemePackCss(activePack);
  }, [themePackId, themePacks]);

  React.useEffect(() => {
    const activePack = themePacks.find((p) => p.id === themePackId);
    const resolveMode = () => {
      if (theme !== "system") return theme;
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    };

    const applyTokens = () => applyThemePackTokens(activePack, resolveMode());
    applyTokens();

    if (theme !== "system") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTokens();
    if (media.addEventListener) {
      media.addEventListener("change", handler);
    } else {
      media.addListener(handler);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handler);
      } else {
        media.removeListener(handler);
      }
    };
  }, [theme, themePackId, themePacks]);

  // --- Derived data from plugin registry ---
  const components = React.useMemo(
    () => collectPluginComponents(registry.plugins),
    [registry.plugins],
  );

  const componentMap = React.useMemo(() => {
    const map = new Map<string, PluginComponentEntry>();
    components.forEach((entry) => map.set(getEntryKey(entry), entry));
    return map;
  }, [components]);

  // Memoize getEntry so SproutTilingLayout doesn't re-render on window changes
  const getEntry = React.useCallback(
    (key: string) => componentMap.get(key),
    [componentMap],
  );

  // Subscribe to windows only for sidebar data — serialize to a string so
  // React's useSyncExternalStore sees a stable snapshot (arrays are new refs).
  const windowSummaryKey = useZenWindowStoreContext(
    React.useCallback(
      (s: { windows: Record<string, any> }) =>
        Object.values(s.windows)
          .filter((w: any) => w.componentId)
          .map((w: any) => `${w.id}\0${w.title}\0${w.componentId}`)
          .sort()
          .join("\n"),
      [],
    ),
  );

  const windowSummaries = React.useMemo(() => {
    if (!windowSummaryKey) return [];
    return windowSummaryKey.split("\n").map((line) => {
      const [id, title, componentId] = line.split("\0");
      return { id, title, componentId };
    });
  }, [windowSummaryKey]);

  const openWindowEntries = React.useMemo(() => {
    const entries: Array<{
      windowId: string;
      title: string;
      entry: PluginComponentEntry;
    }> = [];
    windowSummaries.forEach((win) => {
      const resolved = resolvePluginComponent(
        win.componentId,
        registry.plugins,
      );
      if (!resolved?.def) return;
      entries.push({
        windowId: win.id,
        title: win.title || resolved.def.label || resolved.def.id,
        entry: { pluginId: resolved.pluginId, def: resolved.def },
      });
    });
    return entries;
  }, [registry.plugins, windowSummaries]);

  // --- Smart pruning: only remove tiles whose plugins were previously loaded
  // but have since been unregistered. Never prune tiles for plugins that
  // haven't loaded yet — this prevents the persisted tree from being
  // destroyed during incremental plugin loading.
  const everSeenKeysRef = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (componentMap.size === 0) return;
    // Accumulate all entry keys we've ever seen
    for (const key of componentMap.keys()) {
      everSeenKeysRef.current.add(key);
    }
    if (!tileTree) return;
    // Build the set of keys that are either currently valid OR never-seen-yet
    const currentKeys = new Set(componentMap.keys());
    const allowedKeys = new Set<string>();
    const collectTreeKeys = (node: TileNode | null): void => {
      if (!node) return;
      if (!node.split || !node.children) {
        if (node.entryKey) allowedKeys.add(node.entryKey);
        return;
      }
      collectTreeKeys(node.children[0]);
      collectTreeKeys(node.children[1]);
    };
    collectTreeKeys(tileTree);
    // For each key in the tree, keep it if:
    // - it's currently in componentMap (plugin loaded), OR
    // - we've never seen it before (plugin hasn't loaded yet, don't prune)
    const safeKeys = new Set<string>();
    for (const key of allowedKeys) {
      if (currentKeys.has(key) || !everSeenKeysRef.current.has(key)) {
        safeKeys.add(key);
      }
    }
    const pruned = pruneTreeEntries(tileTree, safeKeys);
    const collapsed = collapseEmptyNodes(pruned);
    if (collapsed !== tileTree) setTileTree(collapsed);
  }, [componentMap, setTileTree, tileTree]);

  // --- Tiling tile assignment ---
  const handleAssignTile = React.useCallback(
    (nodeId: string, payload: TileDragPayload, zone: TileDropZone) => {
      if (!tileTree) return;
      const entryKey = payload.entryKey;
      if (!componentMap.has(entryKey)) return;
      const target = findNodeById(tileTree, nodeId);
      if (!target || target.children) return;
      if (payload.sourceNodeId === nodeId && zone === "center") return;

      const source = payload.sourceNodeId
        ? findNodeById(tileTree, payload.sourceNodeId)
        : null;
      const incomingInstanceId = payload.instanceId || createNodeId();
      const targetInstanceId = target.instanceId;

      const targetEntry = target.entryKey;
      let nextTree = tileTree;

      if (zone === "center") {
        // Replace target tile with the incoming panel.
        // Pop the displaced target out as a minimized floating window
        // so the user can restore it later from the minimized menu.
        if (targetEntry) {
          const targetComponent = componentMap.get(targetEntry);
          if (targetComponent) {
            const componentId = `${targetComponent.pluginId}-${targetComponent.def.id}`;
            const winId = targetInstanceId || createNodeId();
            windowStoreRef.current.openWindow({
              id: winId,
              title: targetComponent.def.label || targetComponent.def.id,
              componentId,
              props: targetComponent.def.props,
            });
            // Immediately minimize so it doesn't pop up as a floating panel
            const ws = zenWindowStore.getState();
            if (ws.windows[winId]) ws.minimizeWindow(winId);
          }
        }

        nextTree = updateNodeById(nextTree, nodeId, (node) => ({
          ...node,
          entryKey,
          instanceId: incomingInstanceId,
        }));
        if (payload.sourceNodeId && payload.sourceNodeId !== nodeId) {
          nextTree = updateNodeById(nextTree, payload.sourceNodeId, (node) => ({
            ...node,
            entryKey: undefined,
            instanceId: undefined,
          }));
        }
        setTileTree(collapseEmptyNodes(nextTree));
        return;
      }

      const split =
        zone === "left" || zone === "right" ? "horizontal" : "vertical";
      const newEntryFirst = zone === "left" || zone === "top";
      const isSameNode = payload.sourceNodeId === nodeId;

      // Resolve by POSITION (target vs incoming), not by entryKey string —
      // otherwise same-type panels (same entryKey) get identical IDs.
      const firstIsTarget = !newEntryFirst;
      const makeLeaf = (isTarget: boolean) => {
        if (isSameNode && !isTarget) {
          // Rearranging within the same node — incoming side becomes empty
          return createLeaf(undefined, undefined, undefined);
        }
        if (isTarget) {
          return createLeaf(targetEntry, target.id, targetInstanceId);
        }
        // Fresh node id for the incoming leaf — do NOT reuse sourceNodeId,
        // because the source node is about to be cleared by id and reusing
        // it would clear the new leaf too.
        return createLeaf(entryKey, undefined, incomingInstanceId);
      };

      nextTree = updateNodeById(nextTree, nodeId, () => ({
        id: createNodeId(),
        split,
        children: [makeLeaf(firstIsTarget), makeLeaf(!firstIsTarget)],
      }));

      if (payload.sourceNodeId && !isSameNode) {
        nextTree = updateNodeById(nextTree, payload.sourceNodeId, (node) => ({
          ...node,
          entryKey: undefined,
          instanceId: undefined,
        }));
      }

      setTileTree(collapseEmptyNodes(nextTree));
    },
    [componentMap, setTileTree, tileTree],
  );

  const handlePopOut = React.useCallback(
    (nodeId: string, entry: PluginComponentEntry, instanceId: string) => {
      const componentId = `${entry.pluginId}-${entry.def.id}`;
      // Use openWindow with the tile's instanceId so the floating panel
      // keeps the same ID — plugins that key localStorage by windowId/id
      // (via usePluginStorage) will find the same persisted state.
      windowStoreRef.current.openWindow({
        id: instanceId,
        title: entry.def.label || entry.def.id,
        componentId,
        props: entry.def.props,
      });
      if (!tileTree) return;
      const nextTree = updateNodeById(tileTree, nodeId, (node) => ({
        ...node,
        entryKey: undefined,
        instanceId: undefined,
      }));
      setTileTree(collapseEmptyNodes(nextTree));
    },
    [setTileTree, tileTree],
  );

  const handleCloseTile = React.useCallback(
    (nodeId: string) => {
      if (!tileTree) return;
      const nextTree = updateNodeById(tileTree, nodeId, (node) => ({
        ...node,
        entryKey: undefined,
        instanceId: undefined,
      }));
      setTileTree(collapseEmptyNodes(nextTree));
    },
    [setTileTree, tileTree],
  );

  const handleToggleTileHeader = React.useCallback(
    (nodeId: string) => {
      if (!tileTree) return;
      const nextTree = updateNodeById(tileTree, nodeId, (node) => ({
        ...node,
        showHeader: node.showHeader === false ? true : false,
      }));
      setTileTree(nextTree);
    },
    [setTileTree, tileTree],
  );

  // --- Floating panel → tile drop handler ---
  // When a floating panel is dropped onto a tile zone while Shift is held,
  // resolve its componentId → entryKey, assign it to the tile, and close
  // the floating window.
  const handleFloatingPanelDrop = React.useCallback(
    (windowId: string, nodeId: string, zone: TileDropZone) => {
      // Look up the window's componentId from the store
      const windows = windowStoreRef.current.getWindows();
      const win = windows[windowId];
      if (!win?.componentId) return;

      // Resolve componentId → pluginId + def → entryKey
      const resolved = resolvePluginComponent(
        win.componentId,
        registry.plugins,
      );
      if (!resolved?.def) return;
      const entry: PluginComponentEntry = {
        pluginId: resolved.pluginId,
        def: resolved.def,
      };
      const entryKey = getEntryKey(entry);
      if (!componentMap.has(entryKey)) return;

      // Reuse the floating window's id as the tile instanceId so plugins
      // that key localStorage by windowId/id preserve their state.
      const payload: TileDragPayload = {
        entryKey,
        instanceId: windowId,
      };

      handleAssignTile(nodeId, payload, zone);

      // Close the floating window now that it's been tiled
      closeWindow(windowId);
    },
    [registry.plugins, componentMap, handleAssignTile, closeWindow],
  );

  return (
    <ZenWebSocketProvider backendUrl={backendUrl} apiKey={apiKey}>
      <EmbeddrProvider api={api}>
        <CoreUIEventBridge api={api} />

        <div className="flex h-full min-h-0">
          {/* ── Sidebar ─────────────────────────────────────── */}
          <SproutSidebar open={showControls}>
            <SproutSidebarContent
              components={components}
              pluginLogos={pluginLogos}
              openWindowEntries={openWindowEntries}
            />
            <SproutUserPanel
              api={api}
              backendUrl={backendUrl}
              apiKey={apiKey}
              setBackendUrl={setBackendUrl}
              setApiKey={setApiKey}
              themePacks={themePacks}
              activePackId={themePackId}
              onSelectPack={setThemePackId}
              onRefreshPacks={refreshThemePacks}
              autoConnect={autoConnect}
            />
          </SproutSidebar>

          {/* ── Tiling canvas ───────────────────────────────── */}
          <div className="flex-1 min-h-0 min-w-0 overflow-hidden p-2">
            <div className="h-full min-h-0 min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-muted/20 p-2">
              <div className="h-full min-h-0 min-w-0 relative">
                {tileTree ? (
                  <SproutTilingLayout
                    tree={tileTree}
                    getEntry={getEntry}
                    api={api}
                    getPluginApi={getPluginApi}
                    onAssignTile={handleAssignTile}
                    onPopOut={handlePopOut}
                    onCloseTile={handleCloseTile}
                    onToggleTileHeader={handleToggleTileHeader}
                    onFloatingPanelDrop={handleFloatingPanelDrop}
                  />
                ) : (
                  <div
                    className="relative flex h-full items-center justify-center rounded-xl border border-dashed border-border/70"
                    onDragOver={(event) => {
                      if (!isTileDrag(event)) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setCanvasPreview(true);
                    }}
                    onDragLeave={(event) => {
                      const related = event.relatedTarget as Node | null;
                      if (related && event.currentTarget.contains(related))
                        return;
                      setCanvasPreview(false);
                    }}
                    onDrop={(event) => {
                      if (!isTileDrag(event)) return;
                      event.preventDefault();
                      const payload = getTileDragData(event);
                      if (!payload) return;
                      if (!componentMap.has(payload.entryKey)) return;
                      setTileTree(
                        createLeaf(
                          payload.entryKey,
                          undefined,
                          payload.instanceId || createNodeId(),
                        ),
                      );
                      setCanvasPreview(false);
                    }}
                  >
                    {canvasPreview ? (
                      <div className="pointer-events-none absolute inset-2 rounded-xl border border-primary/50 bg-primary/10" />
                    ) : null}
                    <div className="text-xs text-muted-foreground">
                      <img
                        src="/favicon.ico"
                        alt="Embeddr"
                        className="w-16 opacity-90 mb-4 mx-auto"
                      />
                      Drag a panel here to start a layout.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <ZenPanels api={api} getPluginApi={getPluginApi} />
      </EmbeddrProvider>
    </ZenWebSocketProvider>
  );
};

// ---------------------------------------------------------------------------
// ZenPreview – root wrapper
// ---------------------------------------------------------------------------

export const ZenPreview = () => {
  const envBackendUrl =
    (import.meta.env.VITE_PUBLIC_EMBEDDR_PUBLIC_URL as string | undefined) ||
    "http://localhost:8003";
  const envGuestApiKey =
    (import.meta.env.VITE_PUBLIC_EMBEDDR_GUEST_API_KEY as string | undefined) ||
    "";

  const [backendUrl, setBackendUrl] = useLocalStorage(
    "sprout-backend-url",
    envBackendUrl,
  );
  const [apiKey, setApiKey] = useLocalStorage("sprout-api-key", envGuestApiKey);

  return (
    <div className="relative h-full min-h-0 rounded-2xl bg-background/60 overflow-hidden">
      <ZenShell
        themeStorageKey="sprout-zen-theme"
        useThemeProvider={false}
        renderPanels={false}
        containPanelsToViewport={true}
        enablePanelGrouping={false}
        autoPanelSafeArea={true}
      >
        <ZenShellBody
          backendUrl={backendUrl}
          apiKey={apiKey}
          setBackendUrl={setBackendUrl}
          setApiKey={setApiKey}
        />
      </ZenShell>
    </div>
  );
};
