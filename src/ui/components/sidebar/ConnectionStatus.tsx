/**
 * ConnectionStatus – compact connection + operator info for the sidebar.
 *
 * Shows backend URL, connection state, and operator info when logged in.
 * Only renders the operator section when data is actually available.
 */

import React from "react";
import type { EmbeddrAPI } from "@embeddr/zen-shell";
import { cn } from "@embeddr/react-ui";
import {
  Wifi,
  WifiOff,
  User,
  Shield,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type ClientInfo = {
  id?: string;
  username?: string;
  display_name?: string;
  avatar_url?: string | null;
  is_admin?: boolean;
};

type OperatorInfo = {
  id?: string;
  name?: string;
  display_name?: string | null;
  avatar_url?: string | null;
  is_root?: boolean;
  is_active?: boolean;
};

interface ConnectionStatusProps {
  api: EmbeddrAPI;
  backendUrl: string;
}

export function ConnectionStatus({ api, backendUrl }: ConnectionStatusProps) {
  const [clientInfo, setClientInfo] = React.useState<ClientInfo | null>(null);
  const [operatorInfo, setOperatorInfo] = React.useState<OperatorInfo | null>(
    null,
  );
  const [connected, setConnected] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      if (!api.security?.overview || !api.security?.operatorProfile) {
        if (active) {
          setConnected(false);
          setClientInfo(null);
          setOperatorInfo(null);
        }
        return;
      }
      try {
        const overview = await api.security.overview();
        const operator = await api.security.operatorProfile();
        if (!active) return;
        setConnected(true);
        setClientInfo((overview as any)?.current_user ?? null);
        setOperatorInfo(operator ?? null);
      } catch {
        if (!active) return;
        setConnected(false);
        setClientInfo(null);
        setOperatorInfo(null);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [api]);

  const displayUrl = React.useMemo(() => {
    try {
      const u = new URL(backendUrl);
      return `${u.hostname}:${u.port || (u.protocol === "https:" ? "443" : "80")}`;
    } catch {
      return backendUrl;
    }
  }, [backendUrl]);

  return (
    <div className="space-y-1">
      {/* Connection row */}
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5",
          "text-left text-xs transition-colors",
          "hover:bg-muted/40",
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        {connected ? (
          <Wifi className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 shrink-0 text-destructive/70" />
        )}
        <span className="flex-1 truncate text-muted-foreground">
          {displayUrl}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="ml-2 space-y-1 border-l border-border/40 pl-3 py-1 animate-in fade-in slide-in-from-top-1 duration-100">
          {/* Client */}
          {clientInfo && (
            <div className="flex items-center gap-2 text-[11px]">
              <User className="h-3 w-3 text-muted-foreground/60" />
              <span className="font-medium">
                {clientInfo.display_name || clientInfo.username || "Unknown"}
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
              <Shield className="h-3 w-3 text-muted-foreground/60" />
              <span className="font-medium">
                {operatorInfo.display_name || operatorInfo.name || "Unknown"}
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

          {!clientInfo && !operatorInfo && (
            <div className="text-[11px] text-muted-foreground/60">
              {connected ? "No auth data" : "Not connected"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
