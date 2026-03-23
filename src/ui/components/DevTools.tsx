/**
 * Developer tools – Lotus action invocation, event bus tester, dialog wrapper.
 */

import React from "react";
import { createEmbeddrClient } from "@embeddr/client-typescript";
import { globalEventBus } from "@embeddr/zen-shell";
import { Button } from "@embeddr/react-ui";
import { Input } from "@embeddr/react-ui";
import { Textarea } from "@embeddr/react-ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@embeddr/react-ui";

const LotusActions = ({
  backendUrl,
  apiKey,
}: {
  backendUrl: string;
  apiKey: string;
}) => {
  const [actions, setActions] = React.useState<Array<any>>([]);
  const [selectedAction, setSelectedAction] = React.useState("");
  const [payload, setPayload] = React.useState("{}");
  const [result, setResult] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const api = React.useMemo(
    () => createEmbeddrClient({ backendUrl, apiKey, apiBasePath: "/api" }),
    [backendUrl, apiKey],
  );

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listLotusCapabilities({
        kind: "action",
        limit: 200,
      });
      const items = (data?.items || []) as Array<any>;
      setActions(items);
      if (!selectedAction && items.length > 0) {
        setSelectedAction(items[0].id || items[0].title || "");
      }
    } catch (error) {
      setResult((error as Error).message || String(error));
    } finally {
      setLoading(false);
    }
  }, [api, selectedAction]);

  React.useEffect(() => {
    if (!backendUrl) return;
    refresh();
  }, [backendUrl, refresh]);

  const handleInvoke = async () => {
    if (!selectedAction) return;
    setLoading(true);
    try {
      const parsed = payload.trim() ? JSON.parse(payload) : {};
      const data = await api.invokeLotus(selectedAction, parsed);
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult((error as Error).message || String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lotus Actions
        </div>
        <Button className="h-7 px-2 text-xs" onClick={refresh}>
          Refresh
        </Button>
      </div>
      <div className="text-xs text-muted-foreground">
        {actions.length}
        {actions.length === 1 ? " action" : " actions"}
      </div>
      <div className="grid gap-2">
        <Input
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value)}
          placeholder="Action ID"
        />
        <Textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder='{"input": "value"}'
          rows={4}
        />
        <Button onClick={handleInvoke} disabled={loading || !selectedAction}>
          {loading ? "Running" : "Invoke"}
        </Button>
        {result ? (
          <pre className="max-h-32 overflow-auto rounded bg-muted/60 p-2 text-[11px]">
            {result}
          </pre>
        ) : null}
      </div>
    </div>
  );
};

const EventTester = () => {
  const [eventName, setEventName] = React.useState("sprout:ping");
  const [payload, setPayload] = React.useState('{"hello":"sprout"}');
  const [events, setEvents] = React.useState<
    Array<{ name: string; payload: string }>
  >([]);

  React.useEffect(() => {
    if (!eventName) return undefined;
    const unsubscribe = globalEventBus.on(eventName, (data) => {
      setEvents((prev) =>
        [{ name: eventName, payload: JSON.stringify(data) }, ...prev].slice(
          0,
          10,
        ),
      );
    });
    return () => unsubscribe();
  }, [eventName]);

  const emit = () => {
    try {
      const parsed = payload.trim() ? JSON.parse(payload) : {};
      globalEventBus.emit(eventName as any, parsed);
    } catch (error) {
      setEvents((prev) =>
        [
          { name: "error", payload: (error as Error).message || String(error) },
          ...prev,
        ].slice(0, 10),
      );
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Events
      </div>
      <Input
        value={eventName}
        onChange={(e) => setEventName(e.target.value)}
        placeholder="event:name"
      />
      <Textarea
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
        rows={3}
      />
      <Button className="h-7 px-2 text-xs" onClick={emit}>
        Emit
      </Button>
      {events.length ? (
        <div className="space-y-2 max-h-28 overflow-auto">
          {events.map((entry, index) => (
            <div
              key={`${entry.name}-${index}`}
              className="rounded bg-muted/60 px-2 py-1 text-[11px]"
            >
              <div className="font-medium">{entry.name}</div>
              <div className="text-muted-foreground break-all">
                {entry.payload}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No events yet.</div>
      )}
    </div>
  );
};

export const DevToolsDialog = ({
  backendUrl,
  apiKey,
}: {
  backendUrl: string;
  apiKey: string;
}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-7 px-2 text-xs">
          Dev Tools
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Developer Tools</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <LotusActions backendUrl={backendUrl} apiKey={apiKey} />
          <EventTester />
        </div>
      </DialogContent>
    </Dialog>
  );
};
