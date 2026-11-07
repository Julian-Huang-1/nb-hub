package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"time"

	"github.com/Julian-Huang-1/nb-hub/server/internal/database"
)

func main() {
	confirmation := flag.String("confirm", "", "database name to delete (nbhub_dev only)")
	flag.Parse()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	if err := database.ResetDevelopment(ctx, os.Getenv("APP_ENV"), os.Getenv("DATABASE_URL"), *confirmation); err != nil {
		slog.Error("database reset refused or failed", "error", err)
		os.Exit(1)
	}
	slog.Info("development database reset and migrated")
}
