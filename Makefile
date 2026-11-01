.PHONY: dev-web dev-desktop dev-mobile api daemon test

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
	cd server && go test ./...
