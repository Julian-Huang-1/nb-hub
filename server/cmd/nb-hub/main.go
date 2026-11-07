package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/Julian-Huang-1/nb-hub/server/internal/daemon"
	"github.com/Julian-Huang-1/nb-hub/server/internal/sitecli"
	"github.com/spf13/cobra"
)

func main() {
	root := &cobra.Command{Use: "nb-hub", Short: "nb-hub command line"}
	sitecli.AddCommands(root)
	root.AddCommand(&cobra.Command{
		Use:   "daemon",
		Short: "Connect the local runtime to the API",
		RunE: func(cmd *cobra.Command, _ []string) error {
			apiURL := os.Getenv("NB_HUB_API_URL")
			if apiURL == "" {
				apiURL = "http://127.0.0.1:8080"
			}
			return daemon.Run(cmd.Context(), apiURL, slog.Default())
		},
	})
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := root.ExecuteContext(ctx); err != nil {
		os.Exit(sitecli.ExitCode(err))
	}
}
