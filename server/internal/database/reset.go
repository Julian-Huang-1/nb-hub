package database

import (
	"context"
	"errors"
	"fmt"
	"net"
	"time"

	"github.com/jackc/pgx/v5"
)

const developmentDatabase = "nbhub_dev"

func resetConfig(appEnv, databaseURL, confirmation string) (*pgx.ConnConfig, error) {
	if appEnv != "development" {
		return nil, errors.New("database reset requires APP_ENV=development")
	}
	if confirmation != developmentDatabase {
		return nil, errors.New("database reset deletes all development data; pass CONFIRM=nbhub_dev")
	}
	if databaseURL == "" {
		return nil, errors.New("DATABASE_URL is required")
	}
	config, err := pgx.ParseConfig(databaseURL)
	if err != nil {
		return nil, errors.New("invalid DATABASE_URL")
	}
	if config.Database != developmentDatabase {
		return nil, fmt.Errorf("database reset only permits %s", developmentDatabase)
	}
	// Validate every effective pgx target, including multi-host fallbacks.
	local := func(host string) bool {
		ip := net.ParseIP(host)
		return ip != nil && ip.IsLoopback()
	}
	if !local(config.Host) {
		return nil, errors.New("database reset requires a literal loopback IP, such as 127.0.0.1")
	}
	for _, fallback := range config.Fallbacks {
		if !local(fallback.Host) {
			return nil, errors.New("database reset refuses a remote fallback host")
		}
	}
	config.ConnectTimeout = 5 * time.Second
	return config, nil
}

func ResetDevelopment(ctx context.Context, appEnv, databaseURL, confirmation string) error {
	config, err := resetConfig(appEnv, databaseURL, confirmation)
	if err != nil {
		return err
	}
	config.Database = "postgres"
	conn, err := pgx.ConnectConfig(ctx, config)
	if err != nil {
		return fmt.Errorf("connect development database administrator: %w", err)
	}
	defer conn.Close(context.Background())
	name := pgx.Identifier{developmentDatabase}.Sanitize()
	if _, err := conn.Exec(ctx, "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)"); err != nil {
		return fmt.Errorf("drop development database: %w", err)
	}
	if _, err := conn.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		return fmt.Errorf("create development database: %w", err)
	}
	return Migrate(ctx, databaseURL)
}
