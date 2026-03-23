/**
 * SproutTilingLayout – tiling layout with **split mode** for rearranging panels.
 *
 * ## Split Mode
 *
 * Hold `Shift` to enter split mode. While active:
 * - A full-coverage overlay appears on every tile (z-30, pointer-events-auto).
 * - Moving the cursor over a tile shows 5-zone indicators (▲▼◀▶⊞) with
 *   closest-edge highlighting and a split preview.
 * - Dragging a panel (from sidebar or tile header) onto a zone performs
 *   the split — the overlay ensures plugin content never intercepts the drag.
 * - Releasing `Shift` exits split mode instantly.
 *
 * Without split mode held, sidebar drags still work for the empty canvas
 * and tile headers (minimal DnD, no conflict with plugin content).
 *
 * ## Portal rendering
 *
 * Plugin components render in a flat container keyed by instanceId (never
 * unmounted on tree restructure). They portal into lightweight slot divs
 * inside the tiling layout.
 */

import React from "react";
import ReactDOM from "react-dom";
import {
  DynamicPluginComponent,
  TilingLayout,
  TILE_DND_MIME,
  getDropZoneFromPointer,
  getTileDragData,
  isTileDrag,
  setTileDragData,
} from "@embeddr/zen-shell";
import type {
  EmbeddrAPI,
  TileDragPayload,
  TileDropZone,
  TileNode,
} from "@embeddr/zen-shell";
import type { PluginComponentEntry } from "./types";

// ---------------------------------------------------------------------------
// Split mode context — tracks whether Shift is held
// ---------------------------------------------------------------------------

const SplitModeContext = React.createContext(false);

function useSplitMode(): boolean {
  return React.useContext(SplitModeContext);
}

/** Track Shift key held state globally.
 *  Only activates when the focused element is NOT a text input / textarea /
 *  contentEditable so that typing with Shift doesn't trigger split mode. */
function useSplitModeTracker(): boolean {
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT")
        return true;
      if ((el as HTMLElement).isContentEditable) return true;
      return false;
    };

    const down = (e: KeyboardEvent) => {
      if (e.key === "Shift" && !isTyping()) setActive(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") setActive(false);
    };
    // Deactivate on blur (user Alt-Tabs away with Shift held)
    const blur = () => setActive(false);

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  return active;
}

// ---------------------------------------------------------------------------
// Tile drag active context — tracks whether a tile drag is in progress.
// When active, the split overlay appears on all occupied tiles so drop zones
// are always visible (previously required Shift to be held).
// ---------------------------------------------------------------------------

const TileDragActiveContext = React.createContext(false);

function useTileDragActive(): boolean {
  return React.useContext(TileDragActiveContext);
}

/** Detect tile drags globally via dataTransfer types. */
function useTileDragActiveTracker(): boolean {
  const [active, setActive] = React.useState(false);
  const depthRef = React.useRef(0);

  React.useEffect(() => {
    const enter = (e: DragEvent) => {
      if (Array.from(e.dataTransfer?.types || []).includes(TILE_DND_MIME)) {
        depthRef.current += 1;
        if (depthRef.current === 1) setActive(true);
      }
    };
    const leave = () => {
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) setActive(false);
    };
    const drop = () => {
      // Defer reset so React's synthetic onDrop handlers (which run during
      // bubble phase AFTER this capture listener) can process the drop before
      // tileDragActive flips to false and unmounts the SplitModeOverlay.
      depthRef.current = 0;
      setTimeout(() => setActive(false), 0);
    };
    const end = () => {
      depthRef.current = 0;
      setTimeout(() => setActive(false), 0);
    };

    // All listeners use capture phase so they fire even when overlay
    // handlers call stopPropagation() during the bubble phase.
    document.addEventListener("dragenter", enter, true);
    document.addEventListener("dragleave", leave, true);
    document.addEventListener("drop", drop, true);
    document.addEventListener("dragend", end, true);
    return () => {
      document.removeEventListener("dragenter", enter, true);
      document.removeEventListener("dragleave", leave, true);
      document.removeEventListener("drop", drop, true);
      document.removeEventListener("dragend", end, true);
    };
  }, []);

  return active;
}

// ---------------------------------------------------------------------------
// Tile zone registry — lets external systems (floating panels) find tile
// zones by screen coordinate without direct DOM access to the tiling tree.
// ---------------------------------------------------------------------------

type TileZoneRegistryCtx = {
  registerTile: (nodeId: string, el: HTMLElement) => void;
  unregisterTile: (nodeId: string) => void;
  findZoneAtPoint: (
    x: number,
    y: number,
  ) => { nodeId: string; zone: TileDropZone } | null;
};

/** Compute drop zone from absolute screen coordinates against a rect. */
function getZoneFromPointAndRect(
  x: number,
  y: number,
  rect: DOMRect,
  threshold = 0.25,
): TileDropZone {
  const rx = x - rect.left;
  const ry = y - rect.top;
  const w = Math.max(rect.width, 1);
  const h = Math.max(rect.height, 1);

  const dTop = ry;
  const dBottom = h - ry;
  const dLeft = rx;
  const dRight = w - rx;
  const edgePx = Math.max(40, Math.min(w, h) * threshold);
  const minDist = Math.min(dTop, dBottom, dLeft, dRight);

  if (minDist > edgePx) return "center";
  if (dTop <= dBottom && dTop <= dLeft && dTop <= dRight) return "top";
  if (dBottom <= dLeft && dBottom <= dRight) return "bottom";
  if (dLeft <= dRight) return "left";
  return "right";
}

const TileZoneRegistryContext = React.createContext<TileZoneRegistryCtx>({
  registerTile: () => {},
  unregisterTile: () => {},
  findZoneAtPoint: () => null,
});

function useTileZoneRegistry(): TileZoneRegistryCtx {
  const tilesRef = React.useRef(new Map<string, HTMLElement>());

  const registerTile = React.useCallback((nodeId: string, el: HTMLElement) => {
    tilesRef.current.set(nodeId, el);
  }, []);

  const unregisterTile = React.useCallback((nodeId: string) => {
    tilesRef.current.delete(nodeId);
  }, []);

  const findZoneAtPoint = React.useCallback((x: number, y: number) => {
    for (const [nodeId, el] of tilesRef.current) {
      const rect = el.getBoundingClientRect();
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        return { nodeId, zone: getZoneFromPointAndRect(x, y, rect) };
      }
    }
    return null;
  }, []);

  return React.useMemo(
    () => ({ registerTile, unregisterTile, findZoneAtPoint }),
    [registerTile, unregisterTile, findZoneAtPoint],
  );
}

/** Expose the tile zone registry for external consumers (ZenPreview). */
export { TileZoneRegistryContext };
export type { TileZoneRegistryCtx };

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

type LeafInfo = {
  instanceId: string;
  entryKey: string;
  nodeId: string;
};

/** Collect all populated leaf nodes from the tiling tree. */
function collectLeaves(node: TileNode | null): LeafInfo[] {
  if (!node) return [];
  if (!node.split || !node.children) {
    if (!node.entryKey) return [];
    return [
      {
        instanceId: node.instanceId || node.id,
        entryKey: node.entryKey,
        nodeId: node.id,
      },
    ];
  }
  return [
    ...collectLeaves(node.children[0]),
    ...collectLeaves(node.children[1]),
  ];
}

// ---------------------------------------------------------------------------
// Preview context – avoids prop-drilling that defeats memo
// ---------------------------------------------------------------------------

type PreviewState = { nodeId: string; zone: TileDropZone } | null;
type PreviewCtx = {
  preview: PreviewState;
  setPreview: React.Dispatch<React.SetStateAction<PreviewState>>;
};
const TilePreviewContext = React.createContext<PreviewCtx>({
  preview: null,
  setPreview: () => {},
});

function useActiveZone(nodeId: string): TileDropZone | null {
  const { preview } = React.useContext(TilePreviewContext);
  return preview && preview.nodeId === nodeId ? preview.zone : null;
}

function useSetPreview() {
  return React.useContext(TilePreviewContext).setPreview;
}

// ---------------------------------------------------------------------------
// Drop zone overlay — shows 5 zone indicators + split preview when dragging
// ---------------------------------------------------------------------------

const ZONE_INDICATORS: Array<{
  zone: TileDropZone;
  label: string;
  pos: string;
}> = [
  { zone: "top", label: "▲", pos: "top-2 left-1/2 -translate-x-1/2" },
  { zone: "bottom", label: "▼", pos: "bottom-2 left-1/2 -translate-x-1/2" },
  { zone: "left", label: "◀", pos: "left-2 top-1/2 -translate-y-1/2" },
  { zone: "right", label: "▶", pos: "right-2 top-1/2 -translate-y-1/2" },
  {
    zone: "center",
    label: "⊞",
    pos: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  },
];

const splitPreviewClass = (zone: TileDropZone): string => {
  const base =
    "pointer-events-none absolute rounded-lg bg-primary/10 border border-primary/30 transition-all duration-100";
  switch (zone) {
    case "left":
      return `${base} inset-y-1 left-1 w-[calc(50%-4px)]`;
    case "right":
      return `${base} inset-y-1 right-1 w-[calc(50%-4px)]`;
    case "top":
      return `${base} inset-x-1 top-1 h-[calc(50%-4px)]`;
    case "bottom":
      return `${base} inset-x-1 bottom-1 h-[calc(50%-4px)]`;
    case "center":
      return `${base} inset-2`;
  }
};

const DropZoneOverlay = React.memo<{ activeZone: TileDropZone }>(
  ({ activeZone }) => (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* Split preview highlight */}
      <div className={splitPreviewClass(activeZone)} />
      {/* Zone indicator icons */}
      {ZONE_INDICATORS.map(({ zone, label, pos }) => (
        <div
          key={zone}
          className={`absolute ${pos} flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-medium shadow-sm transition-all duration-100 ${
            zone === activeZone
              ? "scale-110 bg-primary text-primary-foreground shadow-md"
              : "bg-background/80 text-muted-foreground border border-border/60"
          }`}
        >
          {label}
        </div>
      ))}
    </div>
  ),
);

// ---------------------------------------------------------------------------
// TileContextMenu — portaled right-click context menu for tile header toggle
// ---------------------------------------------------------------------------

const TileContextMenu = React.memo<{
  x: number;
  y: number;
  showHeader: boolean;
  onToggle: () => void;
  onClose: () => void;
}>(({ x, y, showHeader, onToggle, onClose }) => {
  React.useEffect(() => {
    const close = () => onClose();
    window.addEventListener("mousedown", close, { once: true });
    return () => window.removeEventListener("mousedown", close);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      className="fixed z-9999 min-w-35 rounded-md border border-border bg-popover text-popover-foreground shadow-md py-1 text-xs"
      style={{ top: y, left: x }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="w-full px-3 py-1.5 text-left hover:bg-muted transition-colors"
        onClick={() => {
          onToggle();
          onClose();
        }}
      >
        {showHeader ? "Hide header" : "Show header"}
      </button>
    </div>,
    document.body,
  );
});

// ---------------------------------------------------------------------------
// Slot registry – lets portaled components find their target without DOM queries
// ---------------------------------------------------------------------------

type SlotRegistryCtx = {
  slotsRef: React.RefObject<Map<string, HTMLElement>>;
  register: (instanceId: string, el: HTMLElement) => void;
  unregister: (instanceId: string) => void;
  /** Incremented on every register/unregister so consumers re-check. */
  version: number;
};

const SlotRegistryContext = React.createContext<SlotRegistryCtx>({
  slotsRef: { current: new Map() },
  register: () => {},
  unregister: () => {},
  version: 0,
});

function useSlotRegistry(): SlotRegistryCtx {
  const slotsRef = React.useRef(new Map<string, HTMLElement>());
  const [version, setVersion] = React.useState(0);

  const register = React.useCallback((instanceId: string, el: HTMLElement) => {
    slotsRef.current.set(instanceId, el);
    setVersion((v) => v + 1);
  }, []);

  const unregister = React.useCallback((instanceId: string) => {
    slotsRef.current.delete(instanceId);
    setVersion((v) => v + 1);
  }, []);

  return React.useMemo(
    () => ({ slotsRef, register, unregister, version }),
    [register, unregister, version],
  );
}

// ---------------------------------------------------------------------------
// Persistent plugin component – portals into a registered slot
// ---------------------------------------------------------------------------

const PortaledPluginComponent = React.memo<{
  instanceId: string;
  entry: PluginComponentEntry;
  pluginApi: EmbeddrAPI;
}>(
  ({ instanceId, entry, pluginApi }) => {
    const { slotsRef, version } = React.useContext(SlotRegistryContext);
    const slotEl = slotsRef.current.get(instanceId) ?? null;

    // Force re-check when version changes (slot registered/unregistered)
    void version;

    const content = (
      <DynamicPluginComponent
        pluginId={entry.pluginId}
        componentName={entry.def.exportName || entry.def.id}
        api={pluginApi}
        windowId={instanceId}
        id={instanceId}
        {...(entry.def.props || {})}
      />
    );

    if (slotEl) {
      return ReactDOM.createPortal(content, slotEl);
    }
    // Slot not yet registered — render hidden so component state is preserved
    return <div style={{ display: "none" }}>{content}</div>;
  },
  (prev, next) =>
    prev.instanceId === next.instanceId &&
    prev.entry.pluginId === next.entry.pluginId &&
    prev.entry.def.id === next.entry.def.id &&
    prev.pluginApi === next.pluginApi,
);

// ---------------------------------------------------------------------------
// Tile slot – registers itself in the slot registry on mount
// ---------------------------------------------------------------------------

const TileSlot = React.memo<{ instanceId: string }>(({ instanceId }) => {
  const { register, unregister } = React.useContext(SlotRegistryContext);
  const ref = React.useCallback(
    (el: HTMLDivElement | null) => {
      if (el) register(instanceId, el);
      else unregister(instanceId);
    },
    [instanceId, register, unregister],
  );
  return <div ref={ref} className="min-h-0 flex-1 overflow-auto" />;
});

// ---------------------------------------------------------------------------
// Split mode overlay — covers entire tile when Shift is held OR drag active
// ---------------------------------------------------------------------------

/**
 * Full-coverage overlay that appears on a tile when split mode is active
 * (Shift held) OR when a tile drag is in progress (from sidebar or tile header).
 * It has pointer-events-auto and high z-index so it sits above all plugin
 * content, preventing them from swallowing drag events.
 *
 * Shows the 5 zone indicators at all times (dimmed), highlights the closest
 * zone on dragover, and delegates drops to onAssignTileRef.
 */
const SplitModeOverlay = React.memo<{
  nodeId: string;
  onAssignTileRef: React.RefObject<
    (nodeId: string, payload: TileDragPayload, zone: TileDropZone) => void
  >;
}>(({ nodeId, onAssignTileRef }) => {
  const splitMode = useSplitMode();
  const tileDragActive = useTileDragActive();
  const activeZone = useActiveZone(nodeId);
  const setPreview = useSetPreview();

  const handleDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      const zone = getDropZoneFromPointer(event);
      setPreview((prev) => {
        if (prev?.nodeId === nodeId && prev.zone === zone) return prev;
        return { nodeId, zone };
      });
    },
    [nodeId, setPreview],
  );

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const payload = getTileDragData(event);
      if (!payload) return;
      const zone = getDropZoneFromPointer(event);
      onAssignTileRef.current?.(nodeId, payload, zone);
      setPreview(null);
    },
    [nodeId, onAssignTileRef, setPreview],
  );

  const handleDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const related = event.relatedTarget as Node | null;
      if (related && event.currentTarget.contains(related)) return;
      setPreview((prev) => (prev?.nodeId === nodeId ? null : prev));
    },
    [nodeId, setPreview],
  );

  if (!splitMode && !tileDragActive) return null;

  return (
    <div
      className="absolute inset-0 z-30 bg-background/10 backdrop-blur-[1px]"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      {/* Always show zone indicators; highlight when a zone is active */}
      <div className="pointer-events-none absolute inset-0 z-40">
        {activeZone && <div className={splitPreviewClass(activeZone)} />}
        {ZONE_INDICATORS.map(({ zone, label, pos }) => (
          <div
            key={zone}
            className={`absolute ${pos} flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-medium shadow-sm transition-all duration-100 ${
              zone === activeZone
                ? "scale-110 bg-primary text-primary-foreground shadow-md"
                : "bg-background/80 text-muted-foreground border border-border/60"
            }`}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Lightweight leaf shell (just chrome + slot div, no heavy components)
// ---------------------------------------------------------------------------

interface TilingLeafPanelProps {
  nodeId: string;
  instanceId: string;
  entryKey: string | undefined;
  entry: PluginComponentEntry | null | undefined;
  showHeader: boolean;
  onAssignTileRef: React.RefObject<
    (nodeId: string, payload: TileDragPayload, zone: TileDropZone) => void
  >;
  onPopOutRef: React.RefObject<
    (nodeId: string, entry: PluginComponentEntry, instanceId: string) => void
  >;
  onCloseTileRef: React.RefObject<(nodeId: string) => void>;
  onToggleTileHeaderRef: React.RefObject<(nodeId: string) => void>;
}

const TilingLeafPanel = React.memo<TilingLeafPanelProps>(
  ({
    nodeId,
    instanceId,
    entryKey,
    entry,
    showHeader,
    onAssignTileRef,
    onPopOutRef,
    onCloseTileRef,
    onToggleTileHeaderRef,
  }) => {
    const activeZone = useActiveZone(nodeId);
    const setPreview = useSetPreview();
    const splitMode = useSplitMode();
    const { registerTile, unregisterTile } = React.useContext(
      TileZoneRegistryContext,
    );
    const [contextMenu, setContextMenu] = React.useState<{
      x: number;
      y: number;
    } | null>(null);

    // Register this tile's root element for floating-panel drop detection
    const tileRootRef = React.useCallback(
      (el: HTMLDivElement | null) => {
        if (el) registerTile(nodeId, el);
        else unregisterTile(nodeId);
      },
      [nodeId, registerTile, unregisterTile],
    );

    const title = entry?.def.label || entry?.def.id || "";
    const subtitle = entry?.pluginId || "";

    const handleDrop = React.useCallback(
      (event: React.DragEvent<HTMLDivElement>) => {
        if (!isTileDrag(event)) return;
        event.preventDefault();
        const payload = getTileDragData(event);
        if (!payload) return;
        const zone = getDropZoneFromPointer(event);
        onAssignTileRef.current?.(nodeId, payload, zone);
        setPreview(null);
      },
      [nodeId, onAssignTileRef, setPreview],
    );

    const handleDragOver = React.useCallback(
      (event: React.DragEvent<HTMLDivElement>) => {
        if (!isTileDrag(event)) {
          setPreview((prev) => (prev?.nodeId === nodeId ? null : prev));
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const zone = getDropZoneFromPointer(event);
        setPreview((prev) => {
          if (prev?.nodeId === nodeId && prev.zone === zone) return prev;
          return { nodeId, zone };
        });
      },
      [nodeId, setPreview],
    );

    const handleDragLeave = React.useCallback(
      (event: React.DragEvent<HTMLDivElement>) => {
        const related = event.relatedTarget as Node | null;
        if (related && event.currentTarget.contains(related)) return;
        setPreview((prev) => (prev?.nodeId === nodeId ? null : prev));
      },
      [nodeId, setPreview],
    );

    const handleDragStart = React.useCallback(
      (event: React.DragEvent<HTMLDivElement>) => {
        if (!entry || !entryKey) return;
        setTileDragData(event, {
          entryKey,
          sourceNodeId: nodeId,
          instanceId,
        });
      },
      [entry, entryKey, nodeId, instanceId],
    );

    const handlePopOut = React.useCallback(() => {
      if (entry) onPopOutRef.current?.(nodeId, entry, instanceId);
    }, [entry, nodeId, instanceId, onPopOutRef]);

    const handleClose = React.useCallback(() => {
      onCloseTileRef.current?.(nodeId);
    }, [nodeId, onCloseTileRef]);

    const handleToggleHeader = React.useCallback(() => {
      onToggleTileHeaderRef.current?.(nodeId);
    }, [nodeId, onToggleTileHeaderRef]);

    const handleContextMenu = React.useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      },
      [],
    );

    return (
      <div
        ref={tileRootRef}
        className={`relative flex h-full flex-col rounded-xl border border-border/60 bg-background/70 shadow-sm overflow-clip ${
          entry || entryKey ? "" : "items-center justify-center"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {activeZone && !splitMode ? (
          <DropZoneOverlay activeZone={activeZone} />
        ) : null}
        {/* Split mode overlay — full coverage, intercepts drags over plugin content */}
        <SplitModeOverlay nodeId={nodeId} onAssignTileRef={onAssignTileRef} />
        {entry ? (
          <>
            {showHeader ? (
              /* Visible tile header */
              <div
                className="flex items-center justify-between border-b border-border/60 px-2 py-1.5 text-[11px] cursor-grab active:cursor-grabbing"
                draggable
                onDragStart={handleDragStart}
                onContextMenu={handleContextMenu}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{title}</span>
                  <span className="rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
                    {instanceId.slice(0, 8)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <button
                    type="button"
                    className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] transition-colors hover:bg-muted/50"
                    onClick={handlePopOut}
                  >
                    Pop out
                  </button>
                  <button
                    type="button"
                    className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] transition-colors hover:bg-destructive/20 hover:text-destructive"
                    onClick={handleClose}
                    title="Close tile"
                  >
                    ×
                  </button>
                  {subtitle ? (
                    <span className="text-[10px]">{subtitle}</span>
                  ) : null}
                </div>
              </div>
            ) : (
              /* Hidden-header strip — thin draggable bar, right-click to restore */
              <div
                className="group absolute top-0 inset-x-0 z-20 h-1 hover:h-5 transition-all duration-150 cursor-grab active:cursor-grabbing flex items-center bg-transparent hover:bg-muted/40 hover:border-b hover:border-border/40"
                draggable
                onDragStart={handleDragStart}
                onContextMenu={handleContextMenu}
                title="Right-click to show header"
              />
            )}
            <TileSlot instanceId={instanceId} />
          </>
        ) : entryKey ? (
          /* Entry key exists but plugin hasn't loaded yet — show loading placeholder */
          <>
            <div className="flex items-center justify-between border-b border-border/60 px-2 py-1.5 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-muted-foreground animate-pulse">
                  Loading…
                </span>
                <span className="rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
                  {entryKey.split("-").slice(0, 2).join("-")}
                </span>
              </div>
              <button
                type="button"
                className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                onClick={handleClose}
                title="Close tile"
              >
                ×
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <div className="text-xs text-muted-foreground/60">
                Waiting for plugin…
              </div>
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">
            Drop a panel to start a split.
          </div>
        )}

        {contextMenu && (entry || entryKey) && (
          <TileContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            showHeader={showHeader}
            onToggle={handleToggleHeader}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.nodeId === next.nodeId &&
    prev.instanceId === next.instanceId &&
    prev.entryKey === next.entryKey &&
    prev.showHeader === next.showHeader &&
    prev.entry?.pluginId === next.entry?.pluginId &&
    prev.entry?.def.id === next.entry?.def.id,
);

// ---------------------------------------------------------------------------
// Split mode badge — floating indicator when Shift is held
// ---------------------------------------------------------------------------

const SplitModeBadge = () => {
  const splitMode = useSplitMode();
  if (!splitMode) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-2 z-50 -translate-x-1/2 rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground shadow-lg animate-in fade-in duration-150">
      Split Mode — drag panels onto zones
    </div>
  );
};

// ---------------------------------------------------------------------------
// SproutTilingLayout
// ---------------------------------------------------------------------------

export const SproutTilingLayout = React.memo(
  ({
    tree,
    getEntry,
    api,
    getPluginApi,
    onAssignTile,
    onPopOut,
    onCloseTile,
    onToggleTileHeader,
    onFloatingPanelDrop,
  }: {
    tree: TileNode;
    getEntry: (key: string) => PluginComponentEntry | null | undefined;
    api: EmbeddrAPI;
    getPluginApi: (pluginId: string) => EmbeddrAPI;
    onAssignTile: (
      nodeId: string,
      payload: TileDragPayload,
      zone: TileDropZone,
    ) => void;
    onPopOut: (
      nodeId: string,
      entry: PluginComponentEntry,
      instanceId: string,
    ) => void;
    onCloseTile: (nodeId: string) => void;
    onToggleTileHeader: (nodeId: string) => void;
    /** Called when a floating panel is dropped onto a tile zone while Shift is held. */
    onFloatingPanelDrop?: (
      windowId: string,
      nodeId: string,
      zone: TileDropZone,
    ) => void;
  }) => {
    const [preview, setPreview] = React.useState<PreviewState>(null);
    const slotRegistry = useSlotRegistry();
    const tileZoneRegistry = useTileZoneRegistry();
    const splitMode = useSplitModeTracker();
    const tileDragActive = useTileDragActiveTracker();

    const previewCtx = React.useMemo<PreviewCtx>(
      () => ({ preview, setPreview }),
      [preview],
    );

    // Clear preview when split mode and drag both deactivate
    React.useEffect(() => {
      if (!splitMode && !tileDragActive) setPreview(null);
    }, [splitMode, tileDragActive]);

    // Stable refs for callbacks
    const onAssignTileRef = React.useRef(onAssignTile);
    onAssignTileRef.current = onAssignTile;
    const onPopOutRef = React.useRef(onPopOut);
    onPopOutRef.current = onPopOut;
    const onCloseTileRef = React.useRef(onCloseTile);
    onCloseTileRef.current = onCloseTile;
    const onToggleTileHeaderRef = React.useRef(onToggleTileHeader);
    onToggleTileHeaderRef.current = onToggleTileHeader;
    const onFloatingPanelDropRef = React.useRef(onFloatingPanelDrop);
    onFloatingPanelDropRef.current = onFloatingPanelDrop;
    const getEntryRef = React.useRef(getEntry);
    getEntryRef.current = getEntry;
    const getPluginApiRef = React.useRef(getPluginApi);
    getPluginApiRef.current = getPluginApi;
    const apiRef = React.useRef(api);
    apiRef.current = api;
    const splitModeRef = React.useRef(splitMode);
    splitModeRef.current = splitMode;

    // --- Floating panel drag → tile zone preview + drop ---
    // Track mouse globally when a floating panel is being dragged so we can
    // show zone previews and detect drops even though mouse events go to the
    // floating panel (which sits above the tile overlays in the DOM).
    React.useEffect(() => {
      let draggingWindowId: string | null = null;

      const onPanelDragStart = (e: Event) => {
        const detail = (e as CustomEvent).detail as { windowId: string };
        draggingWindowId = detail.windowId;
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!draggingWindowId || !splitModeRef.current) {
          // If split mode turned off while dragging, clear preview
          if (draggingWindowId) {
            setPreview(null);
          }
          return;
        }
        const hit = tileZoneRegistry.findZoneAtPoint(e.clientX, e.clientY);
        if (hit) {
          setPreview((prev) => {
            if (prev?.nodeId === hit.nodeId && prev.zone === hit.zone)
              return prev;
            return { nodeId: hit.nodeId, zone: hit.zone };
          });
        } else {
          setPreview(null);
        }
      };

      const onPanelDragEnd = (e: Event) => {
        const detail = (e as CustomEvent).detail as { windowId: string };
        if (splitModeRef.current) {
          // Use the last known preview position for the drop
          const lastMouse = lastMouseRef.current;
          if (lastMouse) {
            const hit = tileZoneRegistry.findZoneAtPoint(
              lastMouse.x,
              lastMouse.y,
            );
            if (hit) {
              onFloatingPanelDropRef.current?.(
                detail.windowId,
                hit.nodeId,
                hit.zone,
              );
            }
          }
        }
        draggingWindowId = null;
        setPreview(null);
      };

      // Track last mouse position for the drop handler
      const lastMouseRef = { current: null as { x: number; y: number } | null };
      const onMouseTrack = (e: MouseEvent) => {
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      };

      window.addEventListener("zen-panel-drag-start", onPanelDragStart);
      window.addEventListener("zen-panel-drag-end", onPanelDragEnd);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mousemove", onMouseTrack);
      return () => {
        window.removeEventListener("zen-panel-drag-start", onPanelDragStart);
        window.removeEventListener("zen-panel-drag-end", onPanelDragEnd);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mousemove", onMouseTrack);
      };
    }, [tileZoneRegistry, setPreview]);

    // --- Collect leaves for the persistent portal container ---
    const leaves = React.useMemo(() => collectLeaves(tree), [tree]);

    // Stable renderLeaf — only produces lightweight shell + slot div
    const renderLeaf = React.useCallback(
      (node: TileNode) => {
        const entry = node.entryKey ? getEntryRef.current(node.entryKey) : null;
        return (
          <TilingLeafPanel
            key={node.instanceId || node.id}
            nodeId={node.id}
            instanceId={node.instanceId || node.id}
            entryKey={node.entryKey}
            entry={entry}
            showHeader={node.showHeader !== false}
            onAssignTileRef={onAssignTileRef}
            onPopOutRef={onPopOutRef}
            onCloseTileRef={onCloseTileRef}
            onToggleTileHeaderRef={onToggleTileHeaderRef}
          />
        );
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    return (
      <SplitModeContext.Provider value={splitMode}>
        <TileDragActiveContext.Provider value={tileDragActive}>
          <TileZoneRegistryContext.Provider value={tileZoneRegistry}>
            <SlotRegistryContext.Provider value={slotRegistry}>
              <TilePreviewContext.Provider value={previewCtx}>
                {/* Persistent plugin instances — never unmount on tree restructure */}
                {leaves.map((leaf) => {
                  const entry = getEntryRef.current(leaf.entryKey);
                  if (!entry) return null;
                  const pluginApi =
                    getPluginApiRef.current(entry.pluginId) || apiRef.current;
                  return (
                    <PortaledPluginComponent
                      key={leaf.instanceId}
                      instanceId={leaf.instanceId}
                      entry={entry}
                      pluginApi={pluginApi}
                    />
                  );
                })}
                <div className="relative h-full">
                  <SplitModeBadge />
                  <TilingLayout
                    tree={tree}
                    renderLeaf={renderLeaf}
                    className="h-full"
                  />
                </div>
              </TilePreviewContext.Provider>
            </SlotRegistryContext.Provider>
          </TileZoneRegistryContext.Provider>
        </TileDragActiveContext.Provider>
      </SplitModeContext.Provider>
    );
  },
);
