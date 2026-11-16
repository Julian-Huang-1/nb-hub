package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/Julian-Huang-1/nb-hub/server/internal/daemon"
	"github.com/Julian-Huang-1/nb-hub/server/internal/sitecli"
	"github.com/spf13/cobra"
)

// Release builds inject these values with -ldflags; source installs report dev.
var (
	version   = "dev"
	commit    = "unknown"
	buildDate = "unknown"
)

func newRoot() *cobra.Command {
	root := &cobra.Command{Use: "nb-hub", Short: "nb-hub command line", Version: version}
	root.SetVersionTemplate(fmt.Sprintf("nb-hub {{.Version}} (commit %s, built %s)\n", commit, buildDate))
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
	return root
}

func main() {
	root := newRoot()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := root.ExecuteContext(ctx); err != nil {
		os.Exit(sitecli.ExitCode(err))
	}
}
