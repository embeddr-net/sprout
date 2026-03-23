/**
 * Plugin loader UI panel.
 * Connects to a backend and loads external plugins via zen-shell's adapter.
 */

import React from "react";
import {
  createPluginLoaderAdapter,
  loadExternalPlugins,
  usePluginRegistry,
} from "@embeddr/zen-shell";
import { Badge } from "@embeddr/react-ui";
import { Button } from "@embeddr/react-ui";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@embeddr/react-ui";
import { Input } from "@embeddr/react-ui";

export type PluginLoaderProps = {
  backendUrl: string;
  apiKey: string;
  setBackendUrl: (value: string) => void;
  setApiKey: (value: string) => void;
};

export const PluginLoader = ({
  backendUrl,
  apiKey,
  setBackendUrl,
  setApiKey,
}: PluginLoaderProps) => {
  const [loading, setLoading] = React.useState(false);
  const registry = usePluginRegistry();
  const pluginIds = Object.keys(registry.plugins || {});

  const handleLoad = async () => {
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
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Plugin Loader
      </div>
      <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_auto]">
        <Input
          value={backendUrl}
          onChange={(e) => setBackendUrl(e.target.value)}
          placeholder="Backend URL"
        />
        <Input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API Key (optional)"
          type="password"
        />
        <Button onClick={handleLoad} disabled={loading}>
          {loading ? "Loading" : "Load Plugins"}
        </Button>
      </div>
      <Accordion type="single" collapsible>
        <AccordionItem value="plugins">
          <AccordionTrigger className="py-2 text-xs">
            Loaded plugins
            <Badge variant="secondary" className="h-4 px-1.5">
              {pluginIds.length || 0}
            </Badge>
          </AccordionTrigger>
          <AccordionContent>
            {pluginIds.length ? (
              <div className="flex flex-wrap gap-2">
                {pluginIds.map((id) => (
                  <span
                    key={id}
                    className="rounded-full border border-border/60 px-2 py-1 text-[11px]"
                  >
                    {id}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                No plugins loaded.
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
