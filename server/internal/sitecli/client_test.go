package sitecli

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Julian-Huang-1/nb-hub/server/internal/service"
	"github.com/google/uuid"
	"github.com/spf13/cobra"
)

func TestDeployPublishConflict(t *testing.T) {
	site, dep := uuid.New(), uuid.New()
	uploaded := false
	published := false
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer nbp_test" {
			t.Error("missing auth")
		}
		switch {
		case r.Method == "GET" && strings.HasSuffix(r.URL.Path, "/"+site.String()):
			json.NewEncoder(w).Encode(service.Site{ID: site, Revision: 7})
		case r.Method == "POST":
			m, err := r.MultipartReader()
			if err != nil {
				t.Error(err)
				return
			}
			for _, name := range []string{"entrypoint", "message", "file"} {
				p, err := m.NextPart()
				if err != nil || p.FormName() != name {
					t.Error("bad multipart framing", err)
					return
				}
			}
			uploaded = true
			json.NewEncoder(w).Encode(service.Deployment{ID: dep, SiteID: site, Status: "queued"})
		case r.Method == "GET":
			json.NewEncoder(w).Encode(service.Deployment{ID: dep, SiteID: site, Status: "ready"})
		case r.Method == "PUT":
			var b struct {
				DeploymentID     uuid.UUID `json:"deployment_id"`
				ExpectedRevision int64     `json:"expected_revision"`
			}
			if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
				t.Error(err)
			}
			if b.ExpectedRevision != 7 || b.DeploymentID != dep {
				t.Error("wrong publication", b)
			}
			published = true
			w.WriteHeader(409)
			fmt.Fprint(w, `{"code":"publication_conflict","error":"changed"}`)
		default:
			t.Error("unexpected request", r.Method, r.URL.Path)
		}
	}))
	defer api.Close()
	t.Setenv("NB_HUB_TOKEN", "nbp_test")
	f := filepath.Join(t.TempDir(), "index.html")
	os.WriteFile(f, []byte("hello"), 0600)
	root := &cobra.Command{Use: "nb-hub", SilenceErrors: true, SilenceUsage: true}
	AddCommands(root)
	root.SetOut(&bytes.Buffer{})
	root.SetErr(&bytes.Buffer{})
	root.SetArgs([]string{"--server", api.URL, "deploy", f, "--site", site.String(), "--publish"})
	err := root.Execute()
	if ExitCode(err) != 3 || !uploaded || !published {
		t.Fatal(err, uploaded, published)
	}
}
func TestClientDoesNotFollowRedirects(t *testing.T) {
	leaked := false
	other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { leaked = true }))
	defer other.Close()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, other.URL, 302) }))
	defer server.Close()
	c, _ := NewClient(server.URL, "secret")
	err := c.Do(context.Background(), "GET", "/api/v1/sites", nil, nil)
	if err == nil || leaked {
		t.Fatal("redirect leaked credentials", err)
	}
}
func TestDirectoryPackageSkipsSymlinksAndSecrets(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "index.html"), []byte("hello"), 0600)
	os.WriteFile(filepath.Join(dir, ".env"), []byte("secret"), 0600)
	os.Symlink("/etc/passwd", filepath.Join(dir, "link"))
	one, cleanup, err := packagePath(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()
	two, cleanup2, err := packagePath(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup2()
	a, _ := os.ReadFile(one)
	b, _ := os.ReadFile(two)
	if !bytes.Equal(a, b) {
		t.Fatal("packaging is not deterministic")
	}
	z, err := zip.OpenReader(one)
	if err != nil {
		t.Fatal(err)
	}
	defer z.Close()
	if len(z.File) != 1 || z.File[0].Name != "index.html" {
		t.Fatal("symlinks or secret files were packaged", z.File)
	}
}
func TestWaitCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, `{"status":"queued"}`) }))
	defer server.Close()
	c, _ := NewClient(server.URL, "test")
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := c.Wait(ctx, "site", "dep")
	if !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
}
