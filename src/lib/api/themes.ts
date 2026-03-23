export type { ThemePack } from "@embeddr/client-typescript";
import type { ThemePack } from "@embeddr/client-typescript";

const THEME_STYLE_ID = "sprout-theme-pack-css";
const THEME_TOKEN_MARKER = "sprout-theme-pack-tokens";
const appliedTokenKeys = new Set<string>();

export const applyThemePackCss = (pack?: ThemePack | null) => {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(THEME_STYLE_ID);
  if (existing?.parentElement) {
    existing.parentElement.removeChild(existing);
  }

  if (!pack) return;

  if (pack.css) {
    const style = document.createElement("style");
    style.id = THEME_STYLE_ID;
    style.textContent = pack.css;
    document.head.appendChild(style);
    return;
  }

  if (pack.cssUrl) {
    const link = document.createElement("link");
    link.id = THEME_STYLE_ID;
    link.rel = "stylesheet";
    link.href = pack.cssUrl;
    document.head.appendChild(link);
  }
};

export const applyThemePackTokens = (
  pack: ThemePack | null | undefined,
  mode: "light" | "dark",
) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!pack?.tokens) {
    appliedTokenKeys.forEach((key) => root.style.removeProperty(key));
    appliedTokenKeys.clear();
    root.removeAttribute(THEME_TOKEN_MARKER);
    return;
  }

  const tokens = mode === "dark" ? pack.tokens.dark : pack.tokens.light;
  if (!tokens) return;

  appliedTokenKeys.forEach((key) => root.style.removeProperty(key));
  appliedTokenKeys.clear();

  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
    appliedTokenKeys.add(key);
  });
  root.setAttribute(THEME_TOKEN_MARKER, pack.id);
};
