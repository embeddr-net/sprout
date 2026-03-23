/**
 * SproutUserPanel – bottom-of-sidebar "account bar" inspired by Discord/Slack.
 *
 * Compact user bar always visible at the bottom. Click to expand an
 * accordion-based settings panel with sections for:
 *  - Account & Connection (status + auth + logout)
 *  - Appearance (theme mode picker + theme packs)
 *  - Debug (plugin status + developer tools)
 *  - Sidebar pin toggle
 */

import React from "react";
import {
  useLocalStorage,
  usePluginRegistry,
  useTheme,
  type EmbeddrAPI,
} from "@embeddr/zen-shell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  cn,
  Input,
  Label,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@embeddr/react-ui";
import {
  AlertCircle,
  Check,
  ChevronUp,
  Code,
  Eye,
  EyeOff,
  Key,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Paintbrush,
  Pin,
  PinOff,
  Plug,
  RefreshCw,
  Shield,
  Sun,
  User,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { ThemePack } from "@/lib/api/themes";
import type { ThemePackTokens } from "@embeddr/client-typescript";
import { DevToolsDialog } from "../DevTools";
import { PluginStatus } from "./PluginStatus";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoConnectState {
  loading: boolean;
  connected: boolean;
  clientInfo: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
    is_admin?: boolean;
    roles?: string[];
  } | null;
  operatorInfo: {
    display_name?: string;
    name?: string;
    avatar_url?: string;
    contact_email?: string;
    logo_url?: string;
    capabilities?: string[];
    is_root?: boolean;
  } | null;
  handleLoadPlugins: () => Promise<void>;
  handleDisconnect: () => void;
}

export interface SproutUserPanelProps {
  api: EmbeddrAPI;
  backendUrl: string;
  apiKey: string;
  setBackendUrl: (v: string) => void;
  setApiKey: (v: string) => void;
  themePacks: ThemePack[];
  activePackId: string;
  onSelectPack: (id: string) => void;
  onRefreshPacks: () => Promise<void>;
  autoConnect: AutoConnectState;
}

// ---------------------------------------------------------------------------
// Shared accordion trigger style (compact, no underline)
// ---------------------------------------------------------------------------

const triggerCls =
  "py-2 px-2 text-xs gap-2 hover:bg-muted/40 rounded-lg hover:no-underline [&[data-state=open]]:bg-muted/30";

// ---------------------------------------------------------------------------
// Theme preview dots (shows 3-4 key colours from tokens)
// ---------------------------------------------------------------------------

function ThemePreviewDots({ tokens }: { tokens: ThemePackTokens }) {
  const colours = React.useMemo(() => {
    const src = tokens.dark ?? tokens.light ?? {};
    const pick = [
      src["--primary"],
      src["--accent"],
      src["--background"],
      src["--muted"],
    ].filter(Boolean) as string[];
    return pick.slice(0, 4);
  }, [tokens]);

  if (colours.length === 0) return <Paintbrush className="h-3 w-3 shrink-0" />;

  return (
    <div className="flex shrink-0 gap-0.5">
      {colours.map((c, i) => (
        <span
          key={i}
          className="h-3 w-3 rounded-full border border-border/30"
          style={{
            backgroundColor:
              c.startsWith("oklch") ||
              c.startsWith("hsl") ||
              c.startsWith("#") ||
              c.startsWith("rgb")
                ? c
                : `hsl(${c})`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme mode picker
// ---------------------------------------------------------------------------

const THEMES = [
  { key: "light" as const, Icon: Sun, label: "Light" },
  { key: "dark" as const, Icon: Moon, label: "Dark" },
  { key: "system" as const, Icon: Monitor, label: "System" },
];

function ThemeModePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/30 p-0.5">
      {THEMES.map(({ key, Icon, label }) => (
        <Tooltip key={key} delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] transition-colors",
                theme === key
                  ? "bg-background text-foreground shadow-sm font-medium"
                  : "text-muted-foreground/60 hover:text-foreground",
              )}
              onClick={() => setTheme(key)}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {label} mode
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme packs list
// ---------------------------------------------------------------------------

function ThemePacksList({
  packs,
  activePackId,
  onSelect,
  onRefresh,
}: {
  packs: ThemePack[];
  activePackId: string;
  onSelect: (id: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">Theme Packs</span>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
          onClick={handleRefresh}
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
        </button>
      </div>
      {packs.length === 0 ? (
        <div className="text-[11px] text-muted-foreground/50">
          No theme packs available
        </div>
      ) : (
        <div className="h-36">
          <ScrollArea className="h-full">
            <div className="space-y-0.5 pr-1">
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => onSelect(pack.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                    pack.id === activePackId
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                >
                  {pack.iconUrl ? (
                    <img
                      src={pack.iconUrl}
                      alt=""
                      className="h-4 w-4 shrink-0 rounded-sm object-cover"
                    />
                  ) : pack.tokens ? (
                    <ThemePreviewDots tokens={pack.tokens} />
                  ) : (
                    <Paintbrush className="h-3 w-3 shrink-0" />
                  )}
                  <span className="flex-1 truncate text-[11px]">
                    {pack.name}
                  </span>
                  {pack.id === activePackId && (
                    <Check className="h-3 w-3 shrink-0 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connection form – username/password login (default) or API key
// ---------------------------------------------------------------------------

type AuthTab = "login" | "apikey";

function ConnectionForm({
  api,
  backendUrl,
  apiKey,
  setBackendUrl,
  setApiKey,
  loading,
  connected,
  handleLoadPlugins,
  onLogout,
}: {
  api: EmbeddrAPI;
  backendUrl: string;
  apiKey: string;
  setBackendUrl: (v: string) => void;
  setApiKey: (v: string) => void;
  loading: boolean;
  connected: boolean;
  handleLoadPlugins: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [tab, setTab] = React.useState<AuthTab>("login");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [keyInput, setKeyInput] = React.useState(apiKey);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showKey, setShowKey] = React.useState(false);
  const [showAuthControls, setShowAuthControls] = React.useState(false);
  const [loginLoading, setLoginLoading] = React.useState(false);
  const [logoutLoading, setLogoutLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Sync external apiKey changes into the key input field
  React.useEffect(() => {
    setKeyInput(apiKey);
  }, [apiKey]);

  React.useEffect(() => {
    setShowAuthControls(!connected);
  }, [connected]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setError(null);
    setLoginLoading(true);
    try {
      if (!api.security?.login) {
        setError("Login not supported by this API version");
        return;
      }
      const result = await api.security.login({
        username: username.trim(),
        password,
      });
      if (result.ok && result.key) {
        setApiKey(result.key);
        setPassword("");
        setError(null);
      } else {
        setError(result.detail || "Login failed");
      }
    } catch (err: any) {
      setError(err?.message || "Connection error");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleKeyConnect = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setApiKey(keyInput.trim());
  };

  const handleLogoutClick = async () => {
    setError(null);
    setLogoutLoading(true);
    try {
      await onLogout();
      setShowAuthControls(true);
    } catch (err: any) {
      setError(err?.message || "Logout failed");
    } finally {
      setLogoutLoading(false);
    }
  };

  const tabCls = (t: AuthTab) =>
    cn(
      "flex-1 px-2 py-1 text-[11px] rounded-md transition-colors text-center",
      tab === t
        ? "bg-background text-foreground shadow-sm font-medium"
        : "text-muted-foreground/60 hover:text-foreground",
    );

  return (
    <div className="space-y-2.5">
      {/* Backend URL – always visible */}
      <Input
        value={backendUrl}
        onChange={(e) => setBackendUrl(e.target.value)}
        placeholder="Backend URL"
        className="h-7 text-xs"
      />

      {connected && (
        <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Wifi className="h-3 w-3" /> Connected
            </span>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {apiKey ? "API Key" : "Session"}
            </Badge>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 flex-1 gap-1.5 text-xs"
              onClick={handleLoadPlugins}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {loading ? "Loading…" : "Reload Plugins"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={handleLogoutClick}
              disabled={logoutLoading}
            >
              {logoutLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <LogOut className="h-3 w-3" />
              )}
              Logout
            </Button>
          </div>
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowAuthControls((v) => !v)}
          >
            {showAuthControls ? "Hide sign-in options" : "Use different credentials"}
          </button>
        </div>
      )}

      {(!connected || showAuthControls) && (
        <>
          {/* Tab switcher */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/30 p-0.5">
            <button
              type="button"
              className={tabCls("login")}
              onClick={() => {
                setTab("login");
                setError(null);
              }}
            >
              <span className="flex items-center justify-center gap-1">
                <User className="h-3 w-3" /> Login
              </span>
            </button>
            <button
              type="button"
              className={tabCls("apikey")}
              onClick={() => {
                setTab("apikey");
                setError(null);
              }}
            >
              <span className="flex items-center justify-center gap-1">
                <Key className="h-3 w-3" /> API Key
              </span>
            </button>
          </div>

          {/* Login tab */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  Username
                </Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  autoComplete="username"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="h-7 text-xs pr-7"
                  />
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                size="sm"
                className="h-7 w-full gap-1.5 text-xs"
                disabled={loginLoading || !username.trim() || !password.trim()}
              >
                {loginLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <User className="h-3 w-3" />
                )}
                {loginLoading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          )}

          {/* API Key tab */}
          {tab === "apikey" && (
            <form onSubmit={handleKeyConnect} className="space-y-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  API Key
                </Label>
                <div className="relative">
                  <Input
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="em_..."
                    type={showKey ? "text" : "password"}
                    className="h-7 text-xs pr-7"
                  />
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                    onClick={() => setShowKey((v) => !v)}
                    tabIndex={-1}
                  >
                    {showKey ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                size="sm"
                className="h-7 w-full gap-1.5 text-xs"
                disabled={!keyInput.trim()}
              >
                <Key className="h-3 w-3" />
                Connect
              </Button>
            </form>
          )}
        </>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SproutUserPanel({
  api,
  backendUrl,
  apiKey,
  setBackendUrl,
  setApiKey,
  themePacks,
  activePackId,
  onSelectPack,
  onRefreshPacks,
  autoConnect,
}: SproutUserPanelProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [pinned, setPinned] = useLocalStorage("sprout-show-controls", true);

  const registry = usePluginRegistry();
  const pluginCount = Object.keys(registry.plugins || {}).length;

  const {
    loading,
    connected,
    clientInfo,
    operatorInfo,
    handleLoadPlugins,
    handleDisconnect,
  } = autoConnect;

  const handleLogout = React.useCallback(async () => {
    try {
      await api.security?.logout?.();
    } finally {
      handleDisconnect();
    }
  }, [api, handleDisconnect]);

  // Display helpers
  const displayName =
    clientInfo?.display_name ||
    clientInfo?.username ||
    operatorInfo?.display_name ||
    operatorInfo?.name ||
    "Guest";

  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const avatarUrl = clientInfo?.avatar_url || operatorInfo?.avatar_url || null;

  const displayUrl = React.useMemo(() => {
    try {
      const u = new URL(backendUrl);
      return `${u.hostname}:${u.port || (u.protocol === "https:" ? "443" : "80")}`;
    } catch {
      return backendUrl;
    }
  }, [backendUrl]);

  return (
    <div
      className={cn(
        "border-t border-border/40 flex flex-col",
        expanded ? "flex-1 min-h-0" : "shrink-0",
      )}
    >
      {/* ── Expanded accordion panel ───────────────── */}
      {expanded && (
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-2 pt-2 pb-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <Accordion type="multiple" defaultValue={["account"]}>
              {/* ── Account ─────────────────────────── */}
              <AccordionItem value="account">
                <AccordionTrigger className={triggerCls}>
                  <div className="flex items-center gap-2">
                    {connected ? (
                      <Wifi className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5 shrink-0 text-destructive/70" />
                    )}
                    <span className="truncate text-muted-foreground">
                      {displayUrl}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-2 pb-2">
                  <div className="ml-1 space-y-1.5 border-l border-border/40 pl-3">
                    {/* Client */}
                    {clientInfo && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <User className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                        <span className="font-medium">
                          {clientInfo.display_name ||
                            clientInfo.username ||
                            "Unknown"}
                        </span>
                        {clientInfo.is_admin && (
                          <span className="rounded bg-primary/10 px-1 text-[9px] font-semibold text-primary">
                            Admin
                          </span>
                        )}
                      </div>
                    )}

                    {/* Operator */}
                    {operatorInfo && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <Shield className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                        <span className="font-medium">
                          {operatorInfo.display_name ||
                            operatorInfo.name ||
                            "Unknown"}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1 text-[9px] font-semibold",
                            operatorInfo.is_root
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {operatorInfo.is_root ? "Root" : "Standard"}
                        </span>
                      </div>
                    )}

                    {/* Plugins */}
                    {pluginCount > 0 && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <Plug className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                        <span className="text-muted-foreground">
                          {pluginCount} plugin{pluginCount !== 1 && "s"} loaded
                        </span>
                      </div>
                    )}

                    {!clientInfo && !operatorInfo && (
                      <div className="text-[11px] text-muted-foreground/60">
                        {connected ? "No auth data" : "Not connected"}
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <ConnectionForm
                      api={api}
                      backendUrl={backendUrl}
                      apiKey={apiKey}
                      setBackendUrl={setBackendUrl}
                      setApiKey={setApiKey}
                      loading={loading}
                      connected={connected}
                      handleLoadPlugins={handleLoadPlugins}
                      onLogout={handleLogout}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* ── Appearance ───────────────────────── */}
              <AccordionItem value="appearance">
                <AccordionTrigger className={triggerCls}>
                  <div className="flex items-center gap-2">
                    <Paintbrush className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    <span className="text-muted-foreground">Appearance</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-2 pb-2">
                  <div className="space-y-3">
                    <ThemeModePicker />
                    <ThemePacksList
                      packs={themePacks}
                      activePackId={activePackId}
                      onSelect={onSelectPack}
                      onRefresh={onRefreshPacks}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* ── Debug ─────────────────────────────── */}
              <AccordionItem value="devtools">
                <AccordionTrigger className={triggerCls}>
                  <div className="flex items-center gap-2">
                    <Code className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    <span className="text-muted-foreground">Debug</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-2 pb-2">
                  <div className="space-y-3">
                    <PluginStatus />
                    <DevToolsDialog backendUrl={backendUrl} apiKey={apiKey} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* ── Pin sidebar (inline, not accordion) ─ */}
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[11px] text-muted-foreground">
                Pin sidebar
              </span>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md p-1.5 transition-colors",
                      pinned
                        ? "text-foreground bg-muted/50"
                        : "text-muted-foreground/60 hover:text-foreground",
                    )}
                    onClick={() => setPinned(!pinned)}
                  >
                    {pinned ? (
                      <Pin className="h-3 w-3" />
                    ) : (
                      <PinOff className="h-3 w-3" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {pinned ? "Unpin sidebar" : "Pin sidebar open"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </ScrollArea>
      )}

      {/* ── Compact user bar – always pinned at bottom ── */}
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2.5 p-2.5 transition-colors",
          "hover:bg-muted/40 text-left shrink-0",
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        <Avatar className="h-7 w-7 rounded-full">
          {avatarUrl && (
            <AvatarImage
              src={avatarUrl}
              alt={displayName}
              className="rounded-full"
            />
          )}
          <AvatarFallback className="rounded-full text-[10px]">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{displayName}</div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full shrink-0",
                connected ? "bg-emerald-500" : "bg-muted-foreground/40",
              )}
            />
            <span className="truncate">{displayUrl}</span>
          </div>
        </div>

        {pluginCount > 0 && (
          <Badge
            variant="secondary"
            className="h-4.5 gap-1 px-1.5 text-[10px] font-normal shrink-0"
          >
            <Plug className="h-2.5 w-2.5" />
            {pluginCount}
          </Badge>
        )}

        <ChevronUp
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>
    </div>
  );
}
