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
	"github.com/Julian-Huang-1/nb-hub/server/internal/storage"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	var workerDone chan struct{}
	var sites *service.Sites
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
		defer func() {
			stop()
			if workerDone != nil {
				<-workerDone
			}
			pool.Close()
		}()
		config, err := auth.FromEnv()
		if err != nil {
			log.Error("invalid authentication configuration", "error", err)
			os.Exit(1)
		}
		authentication = service.NewAuth(pool, config, &auth.EmailSender{Config: config})
		if os.Getenv("APP_ENV") != "production" || os.Getenv("NB_HUB_CONTENT_DOMAIN") != "" {
			cfg, err := service.SitesConfigFromEnv(config.FrontendOrigin, config.Production)
			if err != nil {
				log.Error("invalid site configuration", "error", err)
				os.Exit(1)
			}
			store, err := storage.New(cfg.Root)
			if err != nil {
				log.Error("site storage unavailable", "error", err)
				os.Exit(1)
			}
			sites = service.NewSites(pool, store, cfg)
			workerDone = make(chan struct{})
			go func() {
				defer close(workerDone)
				sites.RunWorker(ctx, log)
			}()
		}
		log.Info("database connected")
	}
	addr := os.Getenv("NB_HUB_LISTEN_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	server := &http.Server{
		Addr:              addr,
		Handler:           api.RouterWithSites(log, authentication, sites),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       2 * time.Minute,
		WriteTimeout:      3 * time.Minute,
	}
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
