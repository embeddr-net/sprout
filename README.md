# Embeddr Sprout

A lightweight Embeddr client built on [@embeddr/zen-shell](https://github.com/embeddr-net/zen-shell). Connects to any Embeddr instance and renders its plugin panels in a minimal UI.

Use Sprout as a reference for building custom Embeddr frontends, or as a standalone lightweight client.

## Quick Start

```sh
pnpm install
pnpm dev
```

Point it at your Embeddr instance by setting the backend URL:

```sh
VITE_BACKEND_URL="http://localhost:8003/api/v1" pnpm dev
```

## What's included

- Zen Shell integration with panel management
- Sidebar with connection status, plugin status, panel launcher
- Theme controls with live switching
- Command bar
- Tiling layout for panels
- DevTools panel

## Architecture

```
Sprout (this repo)
  └── @embeddr/zen-shell     — panel framework, plugin loader
       ├── @embeddr/react-ui  — UI components
       └── @embeddr/client-typescript — API client
```

Sprout is intentionally minimal — the heavy lifting happens in zen-shell. This makes it easy to build your own Embeddr frontend by swapping Sprout's layout for your own.

## License

Copyright 2026 Embeddr Labs and Contributors

Licensed under the Apache License, Version 2.0.
