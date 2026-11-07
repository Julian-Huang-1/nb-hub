# nb-hub architecture

```text
Web (Next.js) ────────┐
Desktop (Electron) ───┼── HTTP + client WebSocket ── Go API ── PostgreSQL
Mobile (Expo) ────────┘                           │
                                                daemon WebSocket
                                                 │
                                           Local Go daemon ── AI CLI
```

The clients connect to the Go API for health and authentication; the CLI also manages static site deployments. The daemon connects to `/api/daemon/ws`. Workspaces, issues, task claims and AI execution are not implemented.

## Frontend ownership

- `packages/core`: types, API client, TanStack Query helpers and shared state.
- `packages/ui`: reusable primitives and design tokens, with no business imports.
- `packages/views`: web/desktop business pages and common layout.
- `apps/web`: Next.js route tree and browser-specific integration.
- `apps/desktop`: Electron main/preload, tab/window behavior and React Router routes.
- `apps/mobile`: independent native screens, Expo Router and mobile query state.

## Backend ownership

- `server/cmd/server`: API process.
- `server/cmd/nb-hub`: CLI and local daemon process.
- `server/internal/api`: HTTP route composition.
- `server/internal/handler`: HTTP transport boundary.
- `server/internal/service`: business transactions and workflows.
- `server/internal/database`: connection management.
- `server/pkg/db/queries`: handwritten SQL; `generated` is sqlc output.
- `server/internal/realtime`: user-client updates.
- `server/internal/daemonws`: daemon connection and work notification.
- `server/pkg/agent`: adapters for individual AI CLIs.

PostgreSQL will be the authority for business state. A WebSocket wakeup will never be the only source of queued work. Redis can be added for multiple API instances when needed, matching Multica's optional relay role.

## Static site hosting

The API process also runs a single deployment worker and a content-host gateway.
Management requests follow middleware → handler → service → sqlc → PostgreSQL.
Uploads reserve storage quota before streaming to disk; durable PostgreSQL jobs
validate/extract files into immutable local releases. Publishing and rollback
transactionally change the site pointer with an expected revision. Uploaded content
is served on separate hostnames with production `__Host-` cookies and is never
routed to management APIs. Sibling content domains are supported; host Caddy can
use the internal known-site permission endpoint for on-demand TLS.
See [static sites](static-sites.md) for permissions, CLI and deployment details.
