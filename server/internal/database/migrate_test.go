package database

import (
	"context"
	"net/url"
	"os"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/jackc/pgx/v5"
)

// This test requires a disposable database explicitly created by the caller.
func TestMigrationsPostgres(t *testing.T) {
	databaseURL := os.Getenv("NB_HUB_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set NB_HUB_TEST_DATABASE_URL to a disposable nbhub_test_* database")
	}
	config, err := pgx.ParseConfig(databaseURL)
	if err != nil || !strings.HasPrefix(config.Database, "nbhub_test_") {
		t.Fatal("integration database must be named nbhub_test_*")
	}
	ctx := context.Background()
	conn, err := pgx.ConnectConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close(ctx) })
	var existing bool
	if err := conn.QueryRow(ctx, "SELECT to_regclass('schema_migrations') IS NOT NULL OR to_regclass('migration_probe') IS NOT NULL").Scan(&existing); err != nil || existing {
		t.Fatal("integration database must have no migration metadata or probe table", err)
	}
	t.Cleanup(func() {
		if _, err := conn.Exec(ctx, "DROP TABLE IF EXISTS migration_probe; DROP TABLE IF EXISTS schema_migrations"); err != nil {
			t.Error(err)
		}
	})
	migrationURL, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	query := migrationURL.Query()
	query.Set("pool_max_conns", "4")
	migrationURL.RawQuery = query.Encode()
	if err := Migrate(ctx, migrationURL.String()); err != nil {
		t.Fatalf("empty migration set: %v", err)
	}
	files := fstest.MapFS{
		"000001_probe.up.sql":   {Data: []byte("CREATE TABLE migration_probe (id integer PRIMARY KEY);")},
		"000001_probe.down.sql": {Data: []byte("DROP TABLE migration_probe;")},
	}
	for range 2 {
		if err := migrateFS(ctx, databaseURL, files); err != nil {
			t.Fatalf("apply/idempotent replay: %v", err)
		}
	}
	var version int
	var dirty bool
	if err := conn.QueryRow(ctx, "SELECT version, dirty FROM schema_migrations").Scan(&version, &dirty); err != nil || version != 1 || dirty {
		t.Fatalf("migration metadata: version=%d dirty=%v err=%v", version, dirty, err)
	}
	files["000002_failure.up.sql"] = &fstest.MapFile{Data: []byte("SELECT missing_migration_function();")}
	if err := migrateFS(ctx, databaseURL, files); err == nil {
		t.Fatal("invalid migration unexpectedly succeeded")
	}
	if err := migrateFS(ctx, databaseURL, files); err == nil || !strings.Contains(err.Error(), "Dirty database version") {
		t.Fatalf("failed migration must block replay: %v", err)
	}
}
