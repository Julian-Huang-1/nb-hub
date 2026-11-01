# Repository boundaries

nb-hub is a multi-client workspace. Keep platform APIs in their respective apps.

| Path | Responsibility |
| --- | --- |
| `apps/web` | Next.js routes and browser-only code |
| `apps/desktop` | Electron main/preload, desktop routes and native integrations |
| `apps/mobile` | Expo Router, React Native UI and mobile-owned state |
| `packages/core` | Shared types, API client and headless business logic |
| `packages/ui` | UI primitives; no `@nb-hub/core` or business concepts |
| `packages/views` | Web/desktop business pages; depends on core and ui |
| `server/cmd` | API and CLI entry points |
| `server/internal` | Transport, domain services, daemon and persistence boundaries |
| `server/pkg/agent` | AI CLI provider adapters |

Dependency direction is `views -> core + ui`; core and ui are independent. Mobile can import types and pure helpers from core, but owns native screens and query state. Web and desktop route files should remain thin.

HTTP requests should flow through router, middleware, handler, service, sqlc query and PostgreSQL as the first domain features are added. User-facing realtime and daemon connections are separate. Avoid adding placeholder domain models before their product behavior is defined.
