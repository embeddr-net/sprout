/**
 * Theme controls – theme switcher, theme pack picker, and dialog.
 */

import React from "react";
import { useTheme } from "@embeddr/zen-shell";
import { Button } from "@embeddr/react-ui";
import { Badge } from "@embeddr/react-ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@embeddr/react-ui";
import type { ThemePack } from "@/lib/api/themes";
import { ThemeToggle } from "./ThemeToggle";

export const ThemeControls = () => {
  const { theme, setTheme } = useTheme();
  const options: Array<"light" | "dark" | "system"> = [
    "light",
    "dark",
    "system",
  ];

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Theme
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option}
            onClick={() => setTheme(option)}
            className={`h-7 px-3 text-xs capitalize ${
              theme === option ? "border-primary/70" : "opacity-70"
            }`}
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
};

export const ThemePacks = ({
  packs,
  activePackId,
  onSelect,
  onRefresh,
}: {
  packs: ThemePack[];
  activePackId: string;
  onSelect: (value: string) => void;
  onRefresh: () => Promise<void>;
}) => {
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Theme Packs
        </div>
        <Button className="h-7 px-2 text-xs" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
      <div className="text-xs text-muted-foreground">
        {packs.length}
        {packs.length === 1 ? " pack" : " packs"}
      </div>
      <div className="space-y-2 overflow-auto">
        {packs.map((pack) => (
          <button
            key={pack.id}
            type="button"
            onClick={() => onSelect(pack.id)}
            className={`w-full text-left rounded-lg border px-2 py-1 text-xs transition ${
              pack.id === activePackId
                ? "border-primary/60 bg-primary/5"
                : "border-border/60 hover:bg-muted/40"
            }`}
          >
            <div className="font-medium">{pack.name}</div>
            <div className="text-[11px] text-muted-foreground">{pack.id}</div>
          </button>
        ))}
      </div>

      <ThemeToggle />
    </div>
  );
};

export const ThemePackDialog = ({
  packs,
  activePackId,
  onSelect,
  onRefresh,
}: {
  packs: ThemePack[];
  activePackId: string;
  onSelect: (value: string) => void;
  onRefresh: () => Promise<void>;
}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-7 px-2 text-xs">
          Theme Packs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md min-h-[75dvh]">
        <ThemePacks
          packs={packs}
          activePackId={activePackId}
          onSelect={onSelect}
          onRefresh={onRefresh}
        />
      </DialogContent>
    </Dialog>
  );
};
