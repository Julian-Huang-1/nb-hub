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

### Web page organization

The Web app follows Multica's separation of routing, browser integration and
shared business views:

```text
apps/web/
├─ app/
│  ├─ layout.tsx                 Root layout, global styles and WebProviders
│  └─ page.tsx                   / route, renders WebAccount
├─ components/
│  └─ web-providers.tsx          Web-wide React providers
├─ features/
│  └─ auth/web-account.tsx       Cookie auth, browser activity and callback errors
└─ proxy.ts                     Same-origin API rewrites

packages/views/src/
├─ account.tsx                  Shared account UI
└─ home.tsx                     Shared home UI
```

Keep `app` focused on Next.js route files, layouts and route-specific wiring.
Add pages as `<segment>/page.tsx`; ordinary component filenames do not create
URLs. When pages need different shared layouts, use route groups such as
`(auth)` or `(dashboard)` with their own `layout.tsx`; group names do not appear
in URLs. Introduce these groups only when actual pages need them.

Web-wide components and providers belong in `apps/web/components`; browser-only
feature integration belongs in `apps/web/features`, and reusable platform
adapters belong in `apps/web/platform` when needed. Components used only by one
Web route can live in that route's `_components` directory. Business UI shared
with desktop stays in `packages/views`, and generic primitives stay in
`packages/ui`. The home route currently composes the existing shared account
and home views; it does not introduce separate login or workspace routes.

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
