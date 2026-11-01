package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Julian-Huang-1/nb-hub/server/internal/api"
	"github.com/Julian-Huang-1/nb-hub/server/internal/database"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		pool, err := database.Open(context.Background(), databaseURL)
		if err != nil {
			log.Error("database unavailable", "error", err)
			os.Exit(1)
		}
		defer pool.Close()
		log.Info("database connected")
	}
	addr := os.Getenv("NB_HUB_LISTEN_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	server := &http.Server{Addr: addr, Handler: api.Router(log), ReadHeaderTimeout: 10 * time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	log.Info("API listening", "address", addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Error("API stopped", "error", err)
		os.Exit(1)
	}
}
