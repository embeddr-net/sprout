/**
 * ThemeToggleIcon – compact theme toggle for the macOS-style topbar.
 * Cycles through light → dark → system with a single icon button.
 */

import { useTheme } from "@embeddr/zen-shell";
import { Button } from "@embeddr/react-ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@embeddr/react-ui";
import { Sun, Moon, Monitor } from "lucide-react";

const CYCLE: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];

export function ThemeToggleIcon() {
  const { theme, setTheme } = useTheme();

  const next = () => {
    const idx = CYCLE.indexOf(theme as any);
    setTheme(CYCLE[(idx + 1) % CYCLE.length]);
  };

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const label =
    theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6 text-muted-foreground/70 hover:text-foreground"
          onClick={next}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        Theme: {label}
      </TooltipContent>
    </Tooltip>
  );
}
