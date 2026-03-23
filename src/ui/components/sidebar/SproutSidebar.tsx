/**
 * SproutSidebar – Fumadocs-inspired sidebar with hover-to-reveal behavior.
 *
 * When `open` the sidebar is a normal inline column.
 * When collapsed it slides out, but hovering the left edge reveals it as a
 * floating overlay above the content (like fumadocs).
 */

import React from "react";
import { cn } from "@embeddr/react-ui";

const SIDEBAR_WIDTH = 300;
const HOVER_EDGE_PX = 32;
const HOVER_CLOSE_DELAY = 280;

interface SproutSidebarProps {
  open: boolean;
  children: React.ReactNode;
}

export function SproutSidebar({ open, children }: SproutSidebarProps) {
  const [hovering, setHovering] = React.useState(false);
  const [focusLocked, setFocusLocked] = React.useState(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const overlayRef = React.useRef<HTMLDivElement>(null);

  // Track focus within the overlay to prevent closing while typing
  React.useEffect(() => {
    if (open || !overlayRef.current) return;
    const el = overlayRef.current;
    const onFocusIn = () => {
      setFocusLocked(true);
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      // Only unlock if focus moved outside the overlay
      if (!el.contains(e.relatedTarget as Node)) {
        setFocusLocked(false);
      }
    };
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    return () => {
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, [open, hovering]);

  // Helper: is a point inside the overlay bounds?
  const isInsideOverlay = React.useCallback(
    (x: number, y: number) => {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return false;
      return (
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      );
    },
    // overlayRef is stable, but rect changes with layout — no deps needed
    [],
  );

  const scheduleClose = React.useCallback(() => {
    if (focusLocked) return;
    if (!closeTimerRef.current) {
      closeTimerRef.current = setTimeout(() => {
        setHovering(false);
        closeTimerRef.current = null;
      }, HOVER_CLOSE_DELAY);
    }
  }, [focusLocked]);

  const cancelClose = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  // Track mouse: opens sidebar on left edge, closes when cursor leaves overlay.
  // This replaces reliance on mouseleave (which fails during/after drag).
  React.useEffect(() => {
    if (open) {
      setHovering(false);
      return;
    }

    const onMove = (e: MouseEvent) => {
      if (!hovering) {
        // Open when cursor hits the left edge
        if (e.clientX <= HOVER_EDGE_PX) {
          cancelClose();
          setHovering(true);
        }
        return;
      }
      // Sidebar is visible — track cursor for closing
      if (isInsideOverlay(e.clientX, e.clientY)) {
        cancelClose();
      } else {
        scheduleClose();
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [
    open,
    hovering,
    focusLocked,
    isInsideOverlay,
    scheduleClose,
    cancelClose,
  ]);

  // During HTML5 drag, mousemove doesn't fire.
  // Use dragover for position tracking + dragend/drop to force-close.
  React.useEffect(() => {
    if (open || !hovering) return;

    const onDragOver = (e: DragEvent) => {
      if (isInsideOverlay(e.clientX, e.clientY)) {
        cancelClose();
      } else {
        scheduleClose();
      }
    };

    // When drag finishes, schedule close — next mousemove will cancel if
    // the cursor ended up back inside the overlay.
    const onDragEnd = () => scheduleClose();

    // Use capture phase so these fire BEFORE SplitModeOverlay's
    // stopPropagation() kills the event during bubble phase.
    window.addEventListener("dragover", onDragOver, {
      capture: true,
      passive: true,
    } as AddEventListenerOptions);
    window.addEventListener("dragend", onDragEnd, true);
    window.addEventListener("drop", onDragEnd, true);
    return () => {
      window.removeEventListener("dragover", onDragOver, true);
      window.removeEventListener("dragend", onDragEnd, true);
      window.removeEventListener("drop", onDragEnd, true);
    };
  }, [open, hovering, isInsideOverlay, scheduleClose, cancelClose]);

  // Cleanup timer on unmount
  React.useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const content = (
    <div className="flex h-full min-h-0 flex-col">{children}</div>
  );

  // Inline sidebar
  if (open) {
    return (
      <aside
        className="flex h-full min-h-0 flex-col border-r border-border/60 bg-background/80 backdrop-blur-sm"
        style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}
      >
        {content}
      </aside>
    );
  }

  // Collapsed: floating overlay on hover
  if (!hovering) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed left-3 top-3 bottom-3 z-50"
      style={{ width: SIDEBAR_WIDTH }}
    >
      <aside
        className={cn(
          "flex h-full flex-col rounded-xl",
          "border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl",
          "animate-in slide-in-from-left-2 fade-in duration-150",
        )}
      >
        {content}
      </aside>
    </div>
  );
}
