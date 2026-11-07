package handler

import (
	"crypto/sha256"
	"fmt"
	"mime"
	"net/http"
	"os"
	"path"
	"strings"
	"time"

	"github.com/Julian-Huang-1/nb-hub/server/internal/service"
	"github.com/Julian-Huang-1/nb-hub/server/internal/storage"
	"github.com/google/uuid"
)

// SiteContent serves uploaded files on the isolated content domain.
type SiteContent struct{ Sites *service.Sites }

func (g *SiteContent) Wrap(management http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := strings.ToLower(r.Host)
		domain := g.Sites.Config.Domain
		if host == domain || strings.HasSuffix(host, "."+domain) {
			g.ServeHTTP(w, r)
			return
		}
		management.ServeHTTP(w, r)
	})
}
func (g *SiteContent) cookieName() string {
	if g.Sites.Config.Scheme == "https" {
		return "__Host-nbhub_content"
	}
	return "nbhub_content"
}
func (g *SiteContent) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	host := strings.ToLower(r.Host)
	target, preview, err := g.Sites.ResolveContentHost(r.Context(), host)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if r.URL.Path == "/.nbhub/access" {
		if r.Method != "POST" {
			w.Header().Set("Allow", "POST")
			http.Error(w, "method not allowed", 405)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		if err := r.ParseForm(); err != nil {
			http.Error(w, "invalid ticket", 400)
			return
		}
		token, expires, err := g.Sites.ExchangeTicket(r.Context(), host, r.PostForm.Get("ticket"))
		if err != nil {
			http.Error(w, "invalid or expired ticket", 401)
			return
		}
		http.SetCookie(w, &http.Cookie{Name: g.cookieName(), Value: token, Path: "/", Expires: expires, MaxAge: 3600, HttpOnly: true, Secure: g.Sites.Config.Scheme == "https", SameSite: http.SameSiteLaxMode})
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	if r.Method != "GET" && r.Method != "HEAD" {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "method not allowed", 405)
		return
	}
	if target.Visibility == "private" || preview {
		cookie, err := r.Cookie(g.cookieName())
		if err != nil || g.Sites.AuthorizeContent(r.Context(), target.SiteID, host, cookie.Value) != nil {
			http.Error(w, "site owner access required", 401)
			return
		}
	}
	if target.DeploymentID == uuid.Nil {
		http.NotFound(w, r)
		return
	}
	if r.URL.Path == "/" && path.Dir(target.Entrypoint) != "." {
		redirectPath := "/" + target.Entrypoint
		if r.URL.RawQuery != "" {
			redirectPath += "?" + r.URL.RawQuery
		}
		http.Redirect(w, r, redirectPath, http.StatusTemporaryRedirect)
		return
	}
	name := strings.TrimPrefix(r.URL.Path, "/")
	if name == "" {
		name = target.Entrypoint
	} else if strings.HasSuffix(name, "/") {
		name += "index.html"
	}
	if !storage.ValidPath(name) {
		http.NotFound(w, r)
		return
	}
	root, err := os.OpenRoot(g.Sites.Storage.Release(target.SiteID, target.DeploymentID))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer root.Close()
	f, err := root.Open(name)
	if os.IsNotExist(err) && target.RoutingMode == "spa" && path.Ext(name) == "" && strings.Contains(r.Header.Get("Accept"), "text/html") {
		name = target.Entrypoint
		f, err = root.Open(name)
	}
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}
	typ := mime.TypeByExtension(strings.ToLower(path.Ext(name)))
	if typ == "" {
		typ = "application/octet-stream"
	}
	w.Header().Set("Content-Type", typ)
	// All stable URLs revalidate, including formerly public responses. Never let a
	// visibility change leave a reusable public response in a browser/CDN cache.
	if target.Visibility == "public" && !preview {
		w.Header().Set("Cache-Control", "no-cache, must-revalidate")
	}
	etag := sha256.Sum256([]byte(target.DeploymentID.String() + ":" + name))
	w.Header().Set("ETag", fmt.Sprintf("\"%x\"", etag[:16]))
	// A timestamp cannot distinguish two releases created in the same second.
	// Use the deployment-specific ETag as the only cache validator.
	http.ServeContent(w, r, name, time.Time{}, f)
}
