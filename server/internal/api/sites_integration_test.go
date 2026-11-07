package api

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Julian-Huang-1/nb-hub/server/internal/auth"
	"github.com/Julian-Huang-1/nb-hub/server/internal/database"
	"github.com/Julian-Huang-1/nb-hub/server/internal/service"
	"github.com/Julian-Huang-1/nb-hub/server/internal/sitecli"
	"github.com/Julian-Huang-1/nb-hub/server/internal/storage"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestSitesPostgres(t *testing.T) {
	databaseURL := os.Getenv("NB_HUB_SITES_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set NB_HUB_SITES_TEST_DATABASE_URL to a disposable nbhub_test_* database")
	}
	parsed, err := pgxpool.ParseConfig(databaseURL)
	if err != nil || !strings.HasPrefix(parsed.ConnConfig.Database, "nbhub_test_") {
		t.Fatal("sites integration database must be named nbhub_test_*")
	}
	ctx := context.Background()
	if err = database.Migrate(ctx, databaseURL); err != nil {
		t.Fatal(err)
	}
	pool, err := database.Open(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	cfg := auth.Config{Secret: []byte("test-secret-with-at-least-32-bytes"), TTL: time.Hour, AllowSignup: true, DevCode: "123456", FrontendOrigin: "http://localhost:3000", AllowedOrigins: []string{"http://localhost:3000"}}
	authentication := service.NewAuth(pool, cfg, nil)
	store, err := storage.New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	sites := service.NewSites(pool, store, service.SitesConfig{Domain: "content.example.net", Scheme: "http", OwnerQuota: 1 << 30, TotalQuota: 5 << 30})
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	router := RouterWithSites(log, authentication, sites)
	server := httptest.NewServer(router)
	defer server.Close()
	var owners []service.Login
	login := func() service.Login {
		t.Helper()
		email := uuid.NewString() + "@example.com"
		if err := authentication.SendCode(ctx, email); err != nil {
			t.Fatal(err)
		}
		v, err := authentication.VerifyCode(ctx, email, "123456", "sites test")
		if err != nil {
			t.Fatal(err)
		}
		owners = append(owners, v)
		return v
	}
	t.Cleanup(func() {
		for _, u := range owners {
			for _, query := range []string{
				`UPDATE site SET current_deployment_id=NULL WHERE owner_id=$1`,
				`DELETE FROM site_access_ticket WHERE site_id IN (SELECT id FROM site WHERE owner_id=$1)`,
				`DELETE FROM site_content_session WHERE site_id IN (SELECT id FROM site WHERE owner_id=$1)`,
				`DELETE FROM deployment WHERE site_id IN (SELECT id FROM site WHERE owner_id=$1)`,
				`DELETE FROM site WHERE owner_id=$1`, `DELETE FROM personal_access_token WHERE user_id=$1`, `DELETE FROM auth_session WHERE user_id=$1`, `DELETE FROM app_user WHERE id=$1`,
			} {
				if _, err := pool.Exec(ctx, query, u.User.ID); err != nil {
					t.Error(err)
				}
			}
		}
	})
	owner, other := login(), login()
	_, pat, err := authentication.CreatePAT(ctx, service.Identity{User: owner.User, SessionID: owner.SessionID, Kind: "session"}, "sites CLI", 1)
	if err != nil {
		t.Fatal(err)
	}
	client, err := sitecli.NewClient(server.URL, pat)
	if err != nil {
		t.Fatal(err)
	}
	request := func(method, path, body, token, host string, cookie *http.Cookie) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		if host != "" {
			r.Host = host
		}
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		return w
	}
	status := func(w *httptest.ResponseRecorder, want int) {
		t.Helper()
		if w.Code != want {
			t.Fatalf("status=%d want=%d body=%s", w.Code, want, w.Body.String())
		}
	}
	decodeSite := func(w *httptest.ResponseRecorder) service.Site {
		t.Helper()
		var v service.Site
		if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
			t.Fatal(err)
		}
		return v
	}
	process := func() {
		t.Helper()
		worked, err := sites.ProcessDeployment(ctx, log)
		if err != nil || !worked {
			t.Fatal(worked, err)
		}
	}
	status(request("GET", "/api/v1/sites", "", "", "", nil), 401)
	status(request("POST", "/api/v1/sites", `{"name":"bad\u0000name"}`, pat, "", nil), 400)
	created := request("POST", "/api/v1/sites", `{"name":"docs"}`, pat, "", nil)
	status(created, 201)
	site := decodeSite(created)
	if site.Visibility != "private" {
		t.Fatal("site is not private by default")
	}
	base := "/api/v1/sites/" + site.ID.String()
	status(request("GET", base, "", other.Token, "", nil), 404)
	status(request("PATCH", base, `{"visibility":"public","expected_revision":0}`, other.Token, "", nil), 404)
	// Browser writes retain the existing CSRF boundary.
	status(request("POST", "/api/v1/sites", `{"name":"csrf"}`, "", "", &http.Cookie{Name: auth.CookieName, Value: owner.Token}), 403)
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>version one</html>"), 0600)
	os.Mkdir(filepath.Join(dir, "assets"), 0700)
	os.WriteFile(filepath.Join(dir, "assets/main.js"), []byte("console.log('one')"), 0600)
	d1, err := client.Upload(ctx, site.ID.String(), dir, "index.html", "first", "first-key")
	if err != nil {
		t.Fatal(err)
	}
	status(request("PUT", base+"/publication", fmt.Sprintf(`{"deployment_id":%q,"expected_revision":0}`, d1.ID), pat, "", nil), 409)
	// A second worker can recover a task left processing by a crashed process.
	if _, err = sites.Queries.ClaimDeploymentJob(ctx, pgtype.UUID{Bytes: uuid.New(), Valid: true}); err != nil {
		t.Fatal(err)
	}
	if _, err = sites.Queries.StartDeployment(ctx, d1.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = pool.Exec(ctx, `UPDATE deployment_job SET lease_until=now()-interval '1 second' WHERE deployment_id=$1`, d1.ID); err != nil {
		t.Fatal(err)
	}
	process()
	d1, err = sites.GetDeployment(ctx, owner.User.ID, site.ID, d1.ID)
	if err != nil || d1.Status != "ready" {
		t.Fatal(d1, err)
	}
	replay, err := client.Upload(ctx, site.ID.String(), dir, "index.html", "first", "first-key")
	if err != nil || replay.ID != d1.ID {
		t.Fatal("idempotency failed", err)
	}
	os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>version two</html>"), 0600)
	_, err = client.Upload(ctx, site.ID.String(), dir, "index.html", "first", "first-key")
	if sitecli.ExitCode(err) != 3 {
		t.Fatal("changed idempotency payload accepted", err)
	}
	status(request("GET", base+"/deployments/"+d1.ID.String(), "", other.Token, "", nil), 404)
	published := request("PUT", base+"/publication", fmt.Sprintf(`{"deployment_id":%q,"expected_revision":0}`, d1.ID), pat, "", nil)
	status(published, 200)
	site = decodeSite(published)
	host := sites.Host(site.ID, nil)
	preview := sites.Host(site.ID, &d1.ID)
	status(request("GET", "/", "", "", host, nil), 401)
	status(request("GET", "/assets/main.js", "", "", host, nil), 401)
	status(request("GET", "/api/auth/me", "", owner.Token, host, nil), 401)
	status(request("POST", base+"/access-tickets", `{}`, pat, "", nil), 403)
	status(request("POST", base+"/access-tickets", `{}`, other.Token, "", nil), 404)
	ticketResponse := request("POST", base+"/access-tickets", `{}`, owner.Token, "", nil)
	status(ticketResponse, 201)
	var ticket service.AccessTicket
	json.Unmarshal(ticketResponse.Body.Bytes(), &ticket)
	exchange := func(target string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "/.nbhub/access", strings.NewReader(url.Values{"ticket": {ticket.Ticket}}.Encode()))
		r.Host = target
		r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		return w
	}
	status(exchange(preview), 401)
	exchanged := exchange(host)
	status(exchanged, 303)
	cookies := exchanged.Result().Cookies()
	if len(cookies) != 1 || !cookies[0].HttpOnly {
		t.Fatal("missing content cookie")
	}
	cookie := cookies[0]
	status(exchange(host), 401)
	served := request("GET", "/", "", "", host, cookie)
	status(served, 200)
	if !strings.Contains(served.Body.String(), "version one") || served.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatal("wrong private response")
	}
	status(request("GET", "/assets/main.js", "", "", host, cookie), 200)
	status(request("GET", "/", "", "", preview, cookie), 401)
	status(request("GET", "/../index.html", "", "", host, cookie), 404)
	// Public access never exposes version previews, and checks still run for 304s.
	changed := request("PATCH", base, fmt.Sprintf(`{"visibility":"public","expected_revision":%d}`, site.Revision), pat, "", nil)
	status(changed, 200)
	site = decodeSite(changed)
	public := request("GET", "/", "", "", host, nil)
	status(public, 200)
	if !strings.Contains(public.Header().Get("Cache-Control"), "must-revalidate") {
		t.Fatal("unsafe public cache")
	}
	status(request("GET", "/", "", "", preview, nil), 401)
	status(request("GET", "/assets/missing.js", "", "", host, nil), 404)
	d2, err := client.Upload(ctx, site.ID.String(), dir, "index.html", "second", "second-key")
	if err != nil {
		t.Fatal(err)
	}
	process()
	// Only one competing publication can advance a given revision.
	var wg sync.WaitGroup
	results := make(chan int, 2)
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			w := request("PUT", base+"/publication", fmt.Sprintf(`{"deployment_id":%q,"expected_revision":%d}`, d2.ID, site.Revision), pat, "", nil)
			results <- w.Code
		}()
	}
	wg.Wait()
	close(results)
	success, conflict := 0, 0
	for result := range results {
		if result == 200 {
			success++
		}
		if result == 409 {
			conflict++
		}
	}
	if success != 1 || conflict != 1 {
		t.Fatal("publication race", success, conflict)
	}
	served = request("GET", "/", "", "", host, nil)
	status(served, 200)
	if !strings.Contains(served.Body.String(), "version two") {
		t.Fatal("publish did not switch version")
	}
	site, err = sites.Get(ctx, owner.User.ID, site.ID)
	if err != nil {
		t.Fatal(err)
	}
	rollback := request("PUT", base+"/publication", fmt.Sprintf(`{"deployment_id":%q,"expected_revision":%d}`, d1.ID, site.Revision), pat, "", nil)
	status(rollback, 200)
	site = decodeSite(rollback)
	if w := request("GET", "/", "", "", host, nil); !strings.Contains(w.Body.String(), "version one") {
		t.Fatal("rollback failed")
	}
	// The CLI accepts single HTML files, and explicit SPA mode never hides missing assets.
	single := filepath.Join(t.TempDir(), "page.html")
	if err = os.WriteFile(single, []byte("<html>single</html>"), 0600); err != nil {
		t.Fatal(err)
	}
	htmlDeployment, err := client.Upload(ctx, site.ID.String(), single, "index.html", "single", "html-key")
	if err != nil {
		t.Fatal(err)
	}
	process()
	htmlDeployment, err = sites.GetDeployment(ctx, owner.User.ID, site.ID, htmlDeployment.ID)
	if err != nil || htmlDeployment.Status != "ready" {
		t.Fatal(htmlDeployment, err)
	}
	changed = request("PATCH", base, fmt.Sprintf(`{"routing_mode":"spa","expected_revision":%d}`, site.Revision), pat, "", nil)
	status(changed, 200)
	site = decodeSite(changed)
	spaRequest := httptest.NewRequest("GET", "/nested/route", nil)
	spaRequest.Host = host
	spaRequest.Header.Set("Accept", "text/html")
	spaResponse := httptest.NewRecorder()
	router.ServeHTTP(spaResponse, spaRequest)
	status(spaResponse, 200)
	assetRequest := httptest.NewRequest("GET", "/missing.js", nil)
	assetRequest.Host = host
	assetRequest.Header.Set("Accept", "text/html")
	assetResponse := httptest.NewRecorder()
	router.ServeHTTP(assetResponse, assetRequest)
	status(assetResponse, 404)
	// Cross-site deployment IDs cannot be published.
	second := request("POST", "/api/v1/sites", `{"name":"second"}`, pat, "", nil)
	status(second, 201)
	otherSite := decodeSite(second)
	status(request("PUT", "/api/v1/sites/"+otherSite.ID.String()+"/publication", fmt.Sprintf(`{"deployment_id":%q,"expected_revision":0}`, d1.ID), pat, "", nil), 404)
	// Malicious archives become failed deployments without changing the live site.
	bad := filepath.Join(t.TempDir(), "bad.zip")
	var zipBuffer bytes.Buffer
	z := zip.NewWriter(&zipBuffer)
	f, _ := z.Create("../index.html")
	io.WriteString(f, "bad")
	z.Close()
	os.WriteFile(bad, zipBuffer.Bytes(), 0600)
	rejected, err := client.Upload(ctx, site.ID.String(), bad, "index.html", "", "bad-key")
	if err != nil {
		t.Fatal(err)
	}
	process()
	rejected, err = sites.GetDeployment(ctx, owner.User.ID, site.ID, rejected.ID)
	if err != nil || rejected.Status != "failed" || rejected.ErrorCode != "invalid_archive" {
		t.Fatal(rejected, err)
	}
	// Additional multipart parts must not leave a queued job behind.
	var malformed bytes.Buffer
	form := multipart.NewWriter(&malformed)
	p, _ := form.CreateFormFile("file", "index.html")
	io.WriteString(p, "hello")
	form.WriteField("message", "late")
	form.Close()
	r := httptest.NewRequest("POST", base+"/deployments", &malformed)
	r.Header.Set("Content-Type", form.FormDataContentType())
	r.Header.Set("Authorization", "Bearer "+pat)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, r)
	status(w, 400)
	oldQuota := sites.Config.OwnerQuota
	sites.Config.OwnerQuota = 1
	_, err = client.Upload(ctx, site.ID.String(), dir, "index.html", "", "quota-key")
	sites.Config.OwnerQuota = oldQuota
	var apiErr *sitecli.APIError
	if !errors.As(err, &apiErr) || apiErr.Status != 413 {
		t.Fatal("quota bypass", err)
	}
	// Tightening visibility invalidates cached public requests and revoking login
	// invalidates content sessions even before their own expiration.
	changed = request("PATCH", base, fmt.Sprintf(`{"visibility":"private","expected_revision":%d}`, site.Revision), pat, "", nil)
	status(changed, 200)
	site = decodeSite(changed)
	conditional := httptest.NewRequest("GET", "/", nil)
	conditional.Host = host
	conditional.Header.Set("If-None-Match", public.Header().Get("ETag"))
	cw := httptest.NewRecorder()
	router.ServeHTTP(cw, conditional)
	status(cw, 401)
	if err = authentication.RevokeSession(ctx, service.Identity{User: owner.User, SessionID: owner.SessionID, Kind: "session"}, owner.SessionID); err != nil {
		t.Fatal(err)
	}
	status(request("GET", "/", "", "", host, cookie), 401)
	status(request("DELETE", base+"/publication", fmt.Sprintf(`{"expected_revision":%d}`, site.Revision), pat, "", nil), 200)
	status(request("DELETE", base, "", pat, "", nil), 204)
	status(request("GET", "/", "", "", host, nil), 404)
	if _, err = pool.Exec(ctx, `UPDATE site SET deleted_at=now()-interval '11 minutes' WHERE id=$1`, site.ID); err != nil {
		t.Fatal(err)
	}
	if err = sites.CleanupDeployments(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err = os.Stat(store.Release(site.ID, d1.ID)); !os.IsNotExist(err) {
		t.Fatal("deleted files remain")
	}
}
