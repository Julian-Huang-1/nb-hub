package service

import (
	"context"
	"errors"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/Julian-Huang-1/nb-hub/server/internal/database"
	db "github.com/Julian-Huang-1/nb-hub/server/pkg/db/generated"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestSiteShortID(t *testing.T) {
	pattern := regexp.MustCompile(`^[a-z2-7]{10}$`)
	for range 100 {
		id, err := newSiteShortID()
		if err != nil || !pattern.MatchString(id) {
			t.Fatalf("invalid short ID %q: %v", id, err)
		}
	}
}

func TestCreateWithShortIDRetry(t *testing.T) {
	calls := 0
	got, err := createWithShortID(func(id string) (string, error) {
		calls++
		if calls == 1 {
			return "", pgx.ErrNoRows
		}
		return id, nil
	})
	if err != nil || calls != 2 || len(got) != 10 {
		t.Fatal(got, calls, err)
	}
	failure := errors.New("database unavailable")
	calls = 0
	_, err = createWithShortID(func(string) (string, error) { calls++; return "", failure })
	if !errors.Is(err, failure) || calls != 1 {
		t.Fatal("retried an unrelated error", calls, err)
	}
	calls = 0
	_, err = createWithShortID(func(string) (string, error) { calls++; return "", pgx.ErrNoRows })
	if err == nil || calls != 10 {
		t.Fatal("collision retry was not bounded", calls, err)
	}
}

func TestShortIDCollisionPostgres(t *testing.T) {
	databaseURL := os.Getenv("NB_HUB_SITES_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set NB_HUB_SITES_TEST_DATABASE_URL to a disposable nbhub_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(cfg.ConnConfig.Database, "nbhub_test_") {
		t.Fatal("requires nbhub_test_* database")
	}
	ctx := context.Background()
	if err := database.Migrate(ctx, databaseURL); err != nil {
		t.Fatal(err)
	}
	conn, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	// The API integration test may migrate concurrently; this test uses a
	// transaction with its own schema, so it never changes application tables.
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `CREATE TEMP TABLE site (LIKE public.site INCLUDING ALL)`)
	if err != nil {
		t.Fatal(err)
	}
	q := db.New(tx)
	params := db.CreateSiteParams{ID: uuid.New(), OwnerID: uuid.New(), Name: "collision", Visibility: "public", RoutingMode: "static", ShortID: "aaaaaaaaaa"}
	if _, err = q.CreateSite(ctx, params); err != nil {
		t.Fatal(err)
	}
	calls := 0
	got, err := createWithShortID(func(id string) (db.Site, error) {
		calls++
		params.ID = uuid.New()
		params.ShortID = id
		if calls == 1 {
			params.ShortID = "aaaaaaaaaa"
		}
		return q.CreateSite(ctx, params)
	})
	if err != nil || calls != 2 || got.ShortID == "aaaaaaaaaa" {
		t.Fatal("failed to recover from unique collision", calls, err)
	}
}
