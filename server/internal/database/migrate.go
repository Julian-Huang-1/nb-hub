package database

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"time"

	"github.com/Julian-Huang-1/nb-hub/server/migrations"
	"github.com/golang-migrate/migrate/v4"
	pgxmigrate "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
)

func Migrate(ctx context.Context, databaseURL string) error {
	return migrateFS(ctx, databaseURL, migrations.Files)
}

func migrateFS(ctx context.Context, databaseURL string, files fs.FS) error {
	if databaseURL == "" {
		return errors.New("DATABASE_URL is required")
	}
	poolConfig, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return errors.New("invalid DATABASE_URL")
	}
	config := poolConfig.ConnConfig
	config.ConnectTimeout = 5 * time.Second
	db := stdlib.OpenDB(*config)
	defer db.Close()
	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("connect migration database: %w", err)
	}
	source, err := iofs.New(files, ".")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	defer source.Close()
	if _, err := source.First(); errors.Is(err, fs.ErrNotExist) {
		return nil
	} else if err != nil {
		return err
	}
	driver, err := pgxmigrate.WithInstance(db, &pgxmigrate.Config{StatementTimeout: 2 * time.Minute})
	if err != nil {
		return fmt.Errorf("initialize migration database: %w", err)
	}
	runner, err := migrate.NewWithInstance("iofs", source, "pgx5", driver)
	if err != nil {
		driver.Close()
		return err
	}
	defer runner.Close()
	runner.LockTimeout = 30 * time.Second
	if err := runner.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("apply migrations: %w", err)
	}
	return nil
}
