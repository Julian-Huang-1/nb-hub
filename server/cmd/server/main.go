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
	"github.com/Julian-Huang-1/nb-hub/server/internal/auth"
	"github.com/Julian-Huang-1/nb-hub/server/internal/database"
	"github.com/Julian-Huang-1/nb-hub/server/internal/service"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	var authentication *service.Auth
	if os.Getenv("APP_ENV") == "production" && os.Getenv("DATABASE_URL") == "" {
		log.Error("DATABASE_URL is required in production")
		os.Exit(1)
	}
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		pool, err := database.Open(context.Background(), databaseURL)
		if err != nil {
			log.Error("database unavailable", "error", err)
			os.Exit(1)
		}
		defer pool.Close()
		config, err := auth.FromEnv()
		if err != nil {
			log.Error("invalid authentication configuration", "error", err)
			os.Exit(1)
		}
		authentication = service.NewAuth(pool, config, &auth.EmailSender{Config: config})
		log.Info("database connected")
	}
	addr := os.Getenv("NB_HUB_LISTEN_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	server := &http.Server{Addr: addr, Handler: api.Router(log, authentication), ReadHeaderTimeout: 10 * time.Second}
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
