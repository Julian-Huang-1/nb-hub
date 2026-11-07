package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/Julian-Huang-1/nb-hub/server/internal/database"
)

func main() {
	if err := database.Migrate(context.Background(), os.Getenv("DATABASE_URL")); err != nil {
		slog.Error("migration failed", "error", err)
		os.Exit(1)
	}
	slog.Info("database migrations complete")
}
