package sitecli

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/Julian-Huang-1/nb-hub/server/internal/service"
	"github.com/google/uuid"
	"github.com/spf13/cobra"
)

type options struct {
	server string
	json   bool
}

func AddCommands(root *cobra.Command) {
	opts := &options{}
	root.PersistentFlags().StringVar(&opts.server, "server", "", "API origin; defaults to NB_HUB_API_URL or saved configuration")
	root.PersistentFlags().BoolVar(&opts.json, "json", false, "Print compact JSON")
	client := func() (*Client, error) {
		base := opts.server
		if base == "" {
			base = os.Getenv("NB_HUB_API_URL")
		}
		if base == "" {
			base = readServer()
		}
		if base == "" {
			base = "http://127.0.0.1:8080"
		}
		return NewClient(base, os.Getenv("NB_HUB_TOKEN"))
	}
	print := func(cmd *cobra.Command, v any) error {
		e := json.NewEncoder(cmd.OutOrStdout())
		if !opts.json {
			e.SetIndent("", "  ")
		}
		return e.Encode(v)
	}
	site := &cobra.Command{Use: "site", Short: "Manage static sites"}
	var name, visibility, routing string
	create := &cobra.Command{Use: "create", Short: "Create a site", Args: cobra.NoArgs, RunE: func(cmd *cobra.Command, _ []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		var v service.Site
		err = c.Do(cmd.Context(), "POST", "/api/v1/sites", map[string]string{"name": name, "visibility": visibility, "routing_mode": routing}, &v)
		if err != nil {
			return err
		}
		return print(cmd, v)
	}}
	create.Flags().StringVar(&name, "name", "", "Site name")
	_ = create.MarkFlagRequired("name")
	create.Flags().StringVar(&visibility, "visibility", "private", "public or private")
	create.Flags().StringVar(&routing, "routing", "static", "static or spa")
	site.AddCommand(create)
	list := &cobra.Command{Use: "list", Short: "List your sites", Args: cobra.NoArgs}
	addPageFlags(list)
	list.RunE = func(cmd *cobra.Command, _ []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		var v any
		err = c.Do(cmd.Context(), "GET", "/api/v1/sites"+pageQuery(cmd), nil, &v)
		if err != nil {
			return err
		}
		return print(cmd, v)
	}
	site.AddCommand(list)
	site.AddCommand(&cobra.Command{Use: "show <site-id>", Short: "Show a site", Args: ids(1), RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		var v service.Site
		err = c.Do(cmd.Context(), "GET", "/api/v1/sites/"+args[0], nil, &v)
		if err != nil {
			return err
		}
		return print(cmd, v)
	}})
	update := &cobra.Command{Use: "update <site-id>", Short: "Update name, access or routing", Args: ids(1)}
	update.Flags().String("name", "", "Site name")
	update.Flags().String("visibility", "", "public or private")
	update.Flags().String("routing", "", "static or spa")
	update.RunE = func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		var old, v service.Site
		if err = c.Do(cmd.Context(), "GET", "/api/v1/sites/"+args[0], nil, &old); err != nil {
			return err
		}
		body := map[string]any{"expected_revision": old.Revision}
		for _, flag := range []string{"name", "visibility", "routing"} {
			if cmd.Flags().Changed(flag) {
				value, _ := cmd.Flags().GetString(flag)
				key := flag
				if flag == "routing" {
					key = "routing_mode"
				}
				body[key] = value
			}
		}
		if err = c.Do(cmd.Context(), "PATCH", "/api/v1/sites/"+args[0], body, &v); err != nil {
			return err
		}
		return print(cmd, v)
	}
	site.AddCommand(update)
	for _, action := range []string{"publish", "rollback", "unpublish"} {
		cmd := &cobra.Command{Use: action + " <site-id>", Short: action + " a site version", Args: ids(1)}
		if action != "unpublish" {
			cmd.Flags().String("deployment", "", "Deployment ID")
			_ = cmd.MarkFlagRequired("deployment")
		}
		cmd.RunE = func(cmd *cobra.Command, args []string) error {
			c, err := client()
			if err != nil {
				return err
			}
			var old, v service.Site
			if err = c.Do(cmd.Context(), "GET", "/api/v1/sites/"+args[0], nil, &old); err != nil {
				return err
			}
			body := map[string]any{"expected_revision": old.Revision}
			method := "DELETE"
			if action != "unpublish" {
				d, _ := cmd.Flags().GetString("deployment")
				if _, err = uuid.Parse(d); err != nil {
					return fmt.Errorf("invalid deployment ID")
				}
				body["deployment_id"] = d
				method = "PUT"
			}
			if err = c.Do(cmd.Context(), method, "/api/v1/sites/"+args[0]+"/publication", body, &v); err != nil {
				return err
			}
			return print(cmd, v)
		}
		site.AddCommand(cmd)
	}
	site.AddCommand(&cobra.Command{Use: "delete <site-id>", Short: "Take a site offline and schedule file removal", Args: ids(1), RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		if err = c.Do(cmd.Context(), "DELETE", "/api/v1/sites/"+args[0], nil, nil); err != nil {
			return err
		}
		return print(cmd, map[string]string{"deleted": args[0]})
	}})
	deployments := &cobra.Command{Use: "deployment", Short: "Inspect deployments"}
	dl := &cobra.Command{Use: "list", Args: cobra.NoArgs}
	dl.Flags().String("site", "", "Site ID")
	_ = dl.MarkFlagRequired("site")
	addPageFlags(dl)
	dl.RunE = func(cmd *cobra.Command, _ []string) error {
		s, _ := cmd.Flags().GetString("site")
		if _, err := uuid.Parse(s); err != nil {
			return err
		}
		c, err := client()
		if err != nil {
			return err
		}
		var v any
		if err = c.Do(cmd.Context(), "GET", "/api/v1/sites/"+s+"/deployments"+pageQuery(cmd), nil, &v); err != nil {
			return err
		}
		return print(cmd, v)
	}
	deployments.AddCommand(dl)
	deployments.AddCommand(&cobra.Command{Use: "show <site-id> <deployment-id>", Args: ids(2), RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		var v service.Deployment
		if err = c.Do(cmd.Context(), "GET", "/api/v1/sites/"+args[0]+"/deployments/"+args[1], nil, &v); err != nil {
			return err
		}
		return print(cmd, v)
	}})
	deploy := &cobra.Command{Use: "deploy <path>", Short: "Upload HTML, ZIP or a directory", Args: cobra.ExactArgs(1)}
	deploy.Flags().String("site", "", "Site ID")
	_ = deploy.MarkFlagRequired("site")
	deploy.Flags().String("entrypoint", "index.html", "Root-relative entry file")
	deploy.Flags().String("message", "", "Version description")
	deploy.Flags().String("idempotency-key", "", "Retry key (generated if omitted)")
	deploy.Flags().Bool("wait", false, "Wait until processing completes")
	deploy.Flags().Bool("publish", false, "Wait and publish using the original site revision")
	deploy.Flags().Duration("timeout", 5*time.Minute, "Maximum total deployment wait")
	deploy.RunE = func(cmd *cobra.Command, args []string) error {
		s, _ := cmd.Flags().GetString("site")
		if _, err := uuid.Parse(s); err != nil {
			return err
		}
		c, err := client()
		if err != nil {
			return err
		}
		timeout, _ := cmd.Flags().GetDuration("timeout")
		if timeout <= 0 {
			return fmt.Errorf("timeout must be positive")
		}
		ctx, cancel := context.WithTimeout(cmd.Context(), timeout)
		defer cancel()
		entry, _ := cmd.Flags().GetString("entrypoint")
		message, _ := cmd.Flags().GetString("message")
		key, _ := cmd.Flags().GetString("idempotency-key")
		if key == "" {
			key = uuid.NewString()
		}
		wait, _ := cmd.Flags().GetBool("wait")
		publish, _ := cmd.Flags().GetBool("publish")
		var original service.Site
		if err = c.Do(ctx, "GET", "/api/v1/sites/"+s, nil, &original); err != nil {
			return err
		}
		d, err := c.Upload(ctx, s, args[0], entry, message, key)
		if err != nil {
			return err
		}
		// Keep stdout machine-readable; a resumable ID is always available on stderr.
		fmt.Fprintf(cmd.ErrOrStderr(), "Deployment %s; idempotency key %s\n", d.ID, key)
		if wait || publish {
			d, err = c.Wait(ctx, s, d.ID.String())
			if err != nil {
				return err
			}
		}
		if publish {
			var v service.Site
			if err = c.Do(ctx, "PUT", "/api/v1/sites/"+s+"/publication", map[string]any{"deployment_id": d.ID, "expected_revision": original.Revision}, &v); err != nil {
				return err
			}
			return print(cmd, map[string]any{"deployment": d, "site": v})
		}
		return print(cmd, d)
	}
	root.AddCommand(site, deployments, deploy, configCommand())
}
func ids(n int) cobra.PositionalArgs {
	return func(cmd *cobra.Command, args []string) error {
		if err := cobra.ExactArgs(n)(cmd, args); err != nil {
			return err
		}
		for _, s := range args {
			if _, err := uuid.Parse(s); err != nil {
				return fmt.Errorf("invalid ID: %s", s)
			}
		}
		return nil
	}
}
func addPageFlags(c *cobra.Command) {
	c.Flags().Int("limit", 50, "Page size (1–100)")
	c.Flags().Int("offset", 0, "Page offset")
}
func pageQuery(c *cobra.Command) string {
	l, _ := c.Flags().GetInt("limit")
	o, _ := c.Flags().GetInt("offset")
	return fmt.Sprintf("?limit=%d&offset=%d", l, o)
}
func (c *Client) Wait(ctx context.Context, site, id string) (service.Deployment, error) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		var d service.Deployment
		if err := c.Do(ctx, "GET", "/api/v1/sites/"+site+"/deployments/"+id, nil, &d); err != nil {
			return d, err
		}
		switch d.Status {
		case "ready":
			return d, nil
		case "failed":
			return d, fmt.Errorf("deployment %s failed: %s", id, d.ErrorCode)
		}
		select {
		case <-ctx.Done():
			return d, fmt.Errorf("deployment %s: %w", id, ctx.Err())
		case <-ticker.C:
		}
	}
}
func configPath() (string, error) {
	root, err := os.UserConfigDir()
	return filepath.Join(root, "nb-hub", "config.json"), err
}
func readServer() string {
	p, err := configPath()
	if err != nil {
		return ""
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return ""
	}
	var v struct {
		Server string `json:"server"`
	}
	_ = json.Unmarshal(b, &v)
	return v.Server
}
func configCommand() *cobra.Command {
	config := &cobra.Command{Use: "config", Short: "Configure the CLI"}
	set := &cobra.Command{Use: "set server <origin>", Args: func(cmd *cobra.Command, args []string) error {
		if len(args) != 2 || args[0] != "server" {
			return fmt.Errorf("usage: config set server <origin>")
		}
		return nil
	}, RunE: func(cmd *cobra.Command, args []string) error {
		if _, err := NewClient(args[1], "validation"); err != nil {
			return err
		}
		p, err := configPath()
		if err != nil {
			return err
		}
		if err = os.MkdirAll(filepath.Dir(p), 0700); err != nil {
			return err
		}
		b, _ := json.Marshal(map[string]string{"server": args[1]})
		return os.WriteFile(p, b, 0600)
	}}
	config.AddCommand(set)
	return config
}
func ExitCode(err error) int {
	if err == nil {
		return 0
	}
	var api *APIError
	if errors.As(err, &api) && api.Status == 409 {
		return 3
	}
	if errors.Is(err, context.Canceled) {
		return 130
	}
	return 1
}
