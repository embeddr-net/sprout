/**
 * useAutoConnect – runs at app level (not in sidebar) so auto-auth +
 * plugin loading happens regardless of sidebar visibility.
 */

import React from "react";
import {
  createPluginLoaderAdapter,
  loadExternalPlugins,
  usePluginRegistry,
  type EmbeddrAPI,
} from "@embeddr/zen-shell";

interface AutoConnectState {
  loading: boolean;
  connected: boolean;
  clientInfo: ClientInfo | null;
  operatorInfo: OperatorInfo | null;
  handleLoadPlugins: () => Promise<void>;
  handleDisconnect: () => void;
}

interface ClientInfo {
  display_name?: string;
  username?: string;
  avatar_url?: string;
  roles?: string[];
}

interface OperatorInfo {
  display_name?: string;
  name?: string;
  avatar_url?: string;
  contact_email?: string;
  logo_url?: string;
  capabilities?: string[];
}

export function useAutoConnect(
  api: EmbeddrAPI,
  backendUrl: string,
  apiKey: string,
  setApiKey: (value: string) => void,
): AutoConnectState {
  const [loading, setLoading] = React.useState(false);
  const [connected, setConnected] = React.useState(false);
  const [clientInfo, setClientInfo] = React.useState<ClientInfo | null>(null);
  const [operatorInfo, setOperatorInfo] = React.useState<OperatorInfo | null>(
    null,
  );

  // Prevent auto-load from firing multiple times per session
  const autoLoadedRef = React.useRef(false);

  const bootstrapAuthSession = React.useCallback(async () => {
    const key = apiKey.trim();
    if (!key || !backendUrl.trim()) return;

    const base = backendUrl.replace(/\/+$/, "");
    const authBase = /\/api(?:\/v\d+)?$/.test(base) ? base : `${base}/api`;

    await fetch(`${authBase}/system/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": key,
      },
      credentials: "include",
      body: JSON.stringify({ clear: false }),
    });
  }, [apiKey, backendUrl]);

  // Fetch profile info & auto-load plugins when authenticated
  React.useEffect(() => {
    let active = true;

    // Skip auth probe when no API key is set
    if (!apiKey.trim()) {
      setConnected(false);
      setClientInfo(null);
      setOperatorInfo(null);
      return;
    }

    autoLoadedRef.current = false; // reset on api change (new URL/key)

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
        await bootstrapAuthSession();
        const overview = await api.security.overview();
        const operator = await api.security.operatorProfile();
        if (!active) return;
        setConnected(true);
        setClientInfo((overview as any)?.current_user ?? null);
        setOperatorInfo(operator ?? null);

        // Auto-load plugins if authenticated and none loaded yet
        if (!autoLoadedRef.current) {
          autoLoadedRef.current = true;
          const currentPlugins = usePluginRegistry.getState().plugins;
          if (Object.keys(currentPlugins || {}).length === 0) {
            const adapter = createPluginLoaderAdapter({
              backendUrl,
              apiKey: apiKey.trim() || undefined,
            });
            if (active) setLoading(true);
            try {
              await loadExternalPlugins({ adapter });
            } finally {
              if (active) setLoading(false);
            }
          }
        }
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
  }, [api, backendUrl, apiKey, bootstrapAuthSession]);

  const handleLoadPlugins = React.useCallback(async () => {
    setLoading(true);
    try {
      const adapter = createPluginLoaderAdapter({
        backendUrl,
        apiKey: apiKey.trim() || undefined,
      });
      await loadExternalPlugins({ adapter });
    } finally {
      setLoading(false);
    }
  }, [backendUrl, apiKey]);

  const handleDisconnect = React.useCallback(() => {
    setConnected(false);
    setClientInfo(null);
    setOperatorInfo(null);
    setApiKey(""); // clear key so browser can re-fill via autocomplete
    autoLoadedRef.current = true; // prevent auto-reconnect

    // Unregister all plugins
    const state = usePluginRegistry.getState();
    Object.keys(state.plugins).forEach((id) => state.unregisterPlugin(id));
  }, [setApiKey]);

  return {
    loading,
    connected,
    clientInfo,
    operatorInfo,
    handleLoadPlugins,
    handleDisconnect,
  };
}
