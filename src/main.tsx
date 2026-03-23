import React from "react";
import ReactDOM from "react-dom/client";
import * as EmbeddrUI from "@embeddr/react-ui";
import * as Lucide from "lucide-react";
import * as ReactQuery from "@tanstack/react-query";
import * as Recharts from "recharts";
import * as THREE from "three";
import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "@embeddr/react-ui/components/ui";

import { router } from "@/router";
import { ThemeProvider } from "@embeddr/zen-shell";
import { QueryClientProvider } from "@tanstack/react-query";

import "./styles.css";
import { queryClient } from "./ui/lib/query";

const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
  (window as any).React = React;
  (window as any).ReactDOM = ReactDOM;
  (window as any).EmbeddrUI = EmbeddrUI;
  (window as any).Lucide = Lucide;
  (window as any).ReactQuery = ReactQuery;
  (window as any).Recharts = Recharts;
  (window as any).THREE = THREE;
  (window as any).EmbeddrGlobals = {
    React,
    ReactDOM,
    EmbeddrUI,
    Lucide,
    ReactQuery,
    Recharts,
    THREE,
  };
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider storageKey="sprout-theme">
        <RouterProvider router={router} />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}
