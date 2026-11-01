# nb-hub

Multi-client workspace scaffold based on Multica's architecture. This repository contains its own minimal implementation; it does not include Multica's product features.

## Structure

| Path | Responsibility |
| --- | --- |
| `apps/web` | Next.js App Router web client |
| `apps/desktop` | Electron and React Router desktop client |
| `apps/mobile` | Expo Router mobile client |
| `packages/core` | Shared types, API client, and headless queries |
| `packages/ui` | Reusable UI primitives with no business imports |
| `packages/views` | Web/desktop shared business views |
| `server` | Go API, CLI, daemon, and database boundary |

Dependency direction: `views -> core + ui`. Web and desktop own routing and platform behavior. Mobile owns its React Native views and reuses core's types and API client.

## Run

Requirements: Node.js 22, pnpm 10, Go 1.26.9. Run `pnpm install`, then start the API with `make api`. In another terminal run `make dev-web`, `make dev-desktop`, or `make dev-mobile`. To connect a daemon, run `make daemon`.

The clients default to `http://localhost:8080`. Set `NEXT_PUBLIC_API_URL`, `NB_HUB_API_URL`, or `EXPO_PUBLIC_API_URL` as needed. A physical phone needs the computer's LAN address in `EXPO_PUBLIC_API_URL`.

The server currently exposes `/api/health` and `/api/daemon/ws`. PostgreSQL, sqlc queries, authentication, and task execution are reserved architectural boundaries; they will be added with the first real product workflow rather than copied as unrelated Multica behavior.
