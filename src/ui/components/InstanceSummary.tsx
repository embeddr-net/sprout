/**
 * Instance summary panel showing connected client/operator info.
 */

import React from "react";
import type { EmbeddrAPI } from "@embeddr/zen-shell";

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

export const InstanceSummary = ({ api }: { api: EmbeddrAPI }) => {
  const [clientInfo, setClientInfo] = React.useState<ClientInfo | null>(null);
  const [operatorInfo, setOperatorInfo] = React.useState<OperatorInfo | null>(
    null,
  );
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      if (!api.security?.overview || !api.security?.operatorProfile) return;
      setLoading(true);
      try {
        const overview = await api.security.overview();
        const operator = await api.security.operatorProfile();
        if (!active) return;
        setClientInfo((overview as any)?.current_user ?? null);
        setOperatorInfo(operator ?? null);
      } catch {
        if (!active) return;
        setClientInfo(null);
        setOperatorInfo(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [api]);

  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Instance
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading instance...</div>
      ) : (
        <div className="grid gap-2">
          <div className="rounded-md border border-border/60 bg-card/50 p-2">
            <div className="text-[10px] text-muted-foreground">Client</div>
            <div className="text-xs font-medium">
              {clientInfo?.display_name || clientInfo?.username || "Unknown"}
            </div>
            {clientInfo?.username ? (
              <div className="text-[10px] text-muted-foreground">
                {clientInfo.username}
              </div>
            ) : null}
          </div>
          <div className="rounded-md border border-border/60 bg-card/50 p-2">
            <div className="text-[10px] text-muted-foreground">Operator</div>
            <div className="text-xs font-medium">
              {operatorInfo?.display_name || operatorInfo?.name || "Unknown"}
            </div>
            {operatorInfo ? (
              <div className="text-[10px] text-muted-foreground">
                {operatorInfo.is_root ? "Root" : "Standard"}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
