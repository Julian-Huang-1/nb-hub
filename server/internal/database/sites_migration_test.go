package database

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/Julian-Huang-1/nb-hub/server/migrations"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func TestSiteShortIDMigrationPostgres(t *testing.T) {
	databaseURL := os.Getenv("NB_HUB_SITES_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set NB_HUB_SITES_TEST_DATABASE_URL to a disposable nbhub_test_* database")
	}
	cfg, err := pgx.ParseConfig(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(cfg.Database, "nbhub_test_") {
		t.Fatal("requires nbhub_test_* database")
	}
	ctx := context.Background()
	conn, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	schema := pgx.Identifier{"shortid_" + strings.ReplaceAll(uuid.NewString(), "-", "")}.Sanitize()
	if _, err = conn.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer conn.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE")
	if _, err = conn.Exec(ctx, "SET search_path TO "+schema); err != nil {
		t.Fatal(err)
	}
	apply := func(name string) {
		t.Helper()
		sql, err := migrations.Files.ReadFile(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = conn.Exec(ctx, string(sql)); err != nil {
			t.Fatal(name, err)
		}
	}
	for _, name := range []string{"000001_auth.up.sql", "000002_session_owner.up.sql", "000003_pat_owner.up.sql", "000004_sites.up.sql"} {
		apply(name)
	}
	_, err = conn.Exec(ctx, `
 INSERT INTO app_user(id,email,name) VALUES ('00000000-0000-4000-8000-000000000001','migration@example.com','Migration');
 INSERT INTO site(id,owner_id,name,visibility) SELECT gen_random_uuid(),'00000000-0000-4000-8000-000000000001','Existing site','public' FROM generate_series(1,100);
 INSERT INTO deployment(id,site_id,status,format,entrypoint,storage_bytes) SELECT gen_random_uuid(),id,'ready','html','index.html',10 FROM site;
 UPDATE site SET current_deployment_id=(SELECT id FROM deployment WHERE site_id=site.id);`)
	if err != nil {
		t.Fatal(err)
	}
	apply("000005_site_short_ids.up.sql")
	var sites, versions int
	err = conn.QueryRow(ctx, `SELECT count(*) FROM site s JOIN deployment d ON d.id=s.current_deployment_id WHERE s.short_id ~ '^[a-z2-7]{10}$' AND d.short_id ~ '^[a-z2-7]{10}$' AND s.id=d.site_id`).Scan(&sites)
	if err != nil || sites != 100 {
		t.Fatal("backfill changed existing publications or produced invalid IDs", sites, err)
	}
	err = conn.QueryRow(ctx, `SELECT count(DISTINCT short_id) FROM deployment`).Scan(&versions)
	if err != nil || versions != 100 {
		t.Fatal("deployment IDs are not unique", versions, err)
	}
	apply("000005_site_short_ids.down.sql")
	err = conn.QueryRow(ctx, `SELECT count(*) FROM site s JOIN deployment d ON d.id=s.current_deployment_id`).Scan(&sites)
	if err != nil || sites != 100 {
		t.Fatal("rollback changed existing publications", sites, err)
	}
}
