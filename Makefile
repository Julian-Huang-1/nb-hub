.PHONY: up down status dev-web dev-desktop dev-mobile api daemon test test-e2e test-dev-env db-up db-down db-reset migrate prod-env prod-build prod-up prod-down prod-logs

.DEFAULT_GOAL := status

.PHONY: sqlc

ENV_FILE ?= .env.development
DEV = ENV_FILE="$(ENV_FILE)" bash scripts/dev.sh
PROD = docker compose --env-file .env.production -f docker-compose.production.yml

up:
	ENV_FILE="$(ENV_FILE)" C="$(C)" node scripts/dev-env.mjs up

down:
	ENV_FILE="$(ENV_FILE)" node scripts/dev-env.mjs down

status:
	ENV_FILE="$(ENV_FILE)" node scripts/dev-env.mjs status

dev-web:
	$(DEV) sh -c 'pnpm dev:web --port "$${FRONTEND_PORT:-3000}"'

dev-desktop:
	$(DEV) pnpm dev:desktop

dev-mobile:
	$(DEV) pnpm dev:mobile

api:
	$(DEV) sh -c 'cd server && go run ./cmd/server'

daemon:
	$(DEV) sh -c 'cd server && go run ./cmd/nb-hub daemon'

db-up:
	$(DEV) docker compose --env-file "$(ENV_FILE)" -f docker-compose.yml up -d --wait postgres

db-down:
	$(DEV) docker compose --env-file "$(ENV_FILE)" -f docker-compose.yml down

migrate:
	$(DEV) sh -c 'cd server && go run ./cmd/migrate'

sqlc:
	cd server && go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1 generate

db-reset:
	$(DEV) sh -c 'cd server && go run ./cmd/db-reset --confirm "$$1"' -- "$(CONFIRM)"

prod-env:
	bash scripts/init-production.sh

prod-build:
	$(PROD) build api web

prod-up:
	$(PROD) up -d

prod-down:
	$(PROD) down

prod-logs:
	$(PROD) logs -f --tail=100

test:
	pnpm typecheck
	pnpm test
	node --test scripts/dev-env.test.mjs scripts/deploy-production.test.mjs scripts/ensure-cli.test.mjs
	cd server && go test ./...

test-e2e:
	pnpm test:e2e

test-dev-env:
	node --test scripts/dev-env.test.mjs
