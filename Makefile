.PHONY: dev-web dev-desktop dev-mobile api daemon test test-e2e

dev-web:
	pnpm dev:web

dev-desktop:
	pnpm dev:desktop

dev-mobile:
	pnpm dev:mobile

api:
	cd server && go run ./cmd/server

daemon:
	cd server && go run ./cmd/nb-hub daemon

test:
	pnpm typecheck
	pnpm test
	cd server && go test ./...

test-e2e:
	pnpm test:e2e
