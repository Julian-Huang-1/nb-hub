package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Julian-Huang-1/nb-hub/server/internal/auth"
	"github.com/Julian-Huang-1/nb-hub/server/internal/database"
	"github.com/Julian-Huang-1/nb-hub/server/internal/service"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestAuthPostgres(t *testing.T) {
	databaseURL := os.Getenv("NB_HUB_AUTH_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set NB_HUB_AUTH_TEST_DATABASE_URL to a disposable nbhub_test_* database")
	}
	parsed, err := pgxpool.ParseConfig(databaseURL)
	if err != nil || !strings.HasPrefix(parsed.ConnConfig.Database, "nbhub_test_") {
		t.Fatal("auth integration database must be named nbhub_test_*")
	}
	ctx := context.Background()
	if err := database.Migrate(ctx, databaseURL); err != nil {
		t.Fatal(err)
	}
	pool, err := database.Open(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	cfg := auth.Config{Secret: []byte("test-secret-with-at-least-32-bytes"), TTL: time.Minute, AllowSignup: true, DevCode: "123456", FrontendOrigin: "http://localhost:3000", AllowedOrigins: []string{"http://localhost:3000"}}
	svc := service.NewAuth(pool, cfg, nil)
	router := Router(slog.New(slog.NewTextHandler(io.Discard, nil)), svc)
	request := func(method, path, body, token string, cookies []*http.Cookie, csrf, origin string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		for _, cookie := range cookies {
			r.AddCookie(cookie)
		}
		if csrf != "" {
			r.Header.Set("X-CSRF-Token", csrf)
		}
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		r.Header.Set("X-User-ID", uuid.NewString())
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		return w
	}
	requireStatus := func(w *httptest.ResponseRecorder, want int) {
		t.Helper()
		if w.Code != want {
			t.Fatalf("status=%d want=%d body=%s", w.Code, want, w.Body.String())
		}
	}
	var emails []string
	t.Cleanup(func() {
		for _, email := range emails {
			_, err := pool.Exec(ctx, `DELETE FROM personal_access_token WHERE user_id IN (SELECT id FROM app_user WHERE email=$1);`, email)
			if err != nil {
				t.Error(err)
			}
			_, err = pool.Exec(ctx, `DELETE FROM auth_session WHERE user_id IN (SELECT id FROM app_user WHERE email=$1);`, email)
			if err != nil {
				t.Error(err)
			}
			_, err = pool.Exec(ctx, `DELETE FROM login_code WHERE email=$1`, email)
			if err != nil {
				t.Error(err)
			}
			_, err = pool.Exec(ctx, `DELETE FROM app_user WHERE email=$1`, email)
			if err != nil {
				t.Error(err)
			}
		}
	})
	login := func() service.Login {
		email := uuid.NewString() + "@example.com"
		emails = append(emails, email)
		if err := svc.SendCode(ctx, email); err != nil {
			t.Fatal(err)
		}
		result, err := svc.VerifyCode(ctx, email, "123456", "integration test")
		if err != nil {
			t.Fatal(err)
		}
		return result
	}
	requireStatus(request("GET", "/api/auth/me", "", "", nil, "", ""), 401)
	user := login()
	other := login()
	requireStatus(request("POST", "/api/auth/verify-code", fmt.Sprintf(`{"email":%q,"code":"123456"}`, user.User.Email), "", nil, "", ""), 401)
	requireStatus(request("GET", "/api/auth/me", "", user.Token, nil, "", ""), 200)
	cookies := []*http.Cookie{{Name: auth.CookieName, Value: user.Token}, {Name: auth.CSRFCookie, Value: auth.CSRF(cfg.Secret, user.SessionID)}}
	csrf := auth.CSRF(cfg.Secret, user.SessionID)
	requireStatus(request("POST", "/api/auth/tokens", `{"name":"CLI","expires_in_days":1}`, "", cookies, "", ""), 403)
	requireStatus(request("POST", "/api/auth/tokens", `{"name":"CLI","expires_in_days":1}`, "", cookies, csrf, "https://untrusted.example"), 403)
	created := request("POST", "/api/auth/tokens", `{"name":"CLI","expires_in_days":1}`, "", cookies, csrf, "http://localhost:3000")
	requireStatus(created, 201)
	var pat struct {
		Token    string `json:"token"`
		Metadata struct {
			ID uuid.UUID `json:"id"`
		} `json:"personal_access_token"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &pat); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(pat.Token, "nbp_") {
		t.Fatal("missing PAT")
	}
	me := request("GET", "/api/auth/me", "", pat.Token, nil, "", "")
	requireStatus(me, 200)
	if !strings.Contains(me.Body.String(), user.User.Email) || strings.Contains(me.Body.String(), other.User.Email) {
		t.Fatal("wrong PAT identity")
	}
	requireStatus(request("POST", "/api/auth/refresh", "", pat.Token, nil, "", ""), 403)
	requireStatus(request("POST", "/api/auth/tokens", `{"name":"nested","expires_in_days":1}`, pat.Token, nil, "", ""), 403)
	listed := request("GET", "/api/auth/tokens", "", user.Token, nil, "", "")
	requireStatus(listed, 200)
	if strings.Contains(listed.Body.String(), pat.Token) {
		t.Fatal("PAT plaintext leaked in list")
	}
	requireStatus(request("DELETE", "/api/auth/tokens/"+pat.Metadata.ID.String(), "", other.Token, nil, "", ""), 204)
	requireStatus(request("GET", "/api/auth/me", "", pat.Token, nil, "", ""), 200)
	requireStatus(request("DELETE", "/api/auth/tokens/"+pat.Metadata.ID.String(), "", user.Token, nil, "", ""), 204)
	requireStatus(request("GET", "/api/auth/me", "", pat.Token, nil, "", ""), 401)
	short, _ := auth.Sign(cfg.Secret, user.User.ID, user.SessionID, time.Now().Add(20*time.Second))
	renewed := request("POST", "/api/auth/refresh", "", short, nil, "", "")
	requireStatus(renewed, 200)
	if !strings.Contains(renewed.Body.String(), `"renewed":true`) {
		t.Fatal("active session was not renewed")
	}
	requireStatus(request("POST", "/api/auth/logout", "", user.Token, nil, "", ""), 204)
	requireStatus(request("GET", "/api/auth/me", "", user.Token, nil, "", ""), 401)
	expired, _ := auth.Sign(cfg.Secret, other.User.ID, other.SessionID, time.Now().Add(-time.Minute))
	requireStatus(request("POST", "/api/auth/refresh", "", expired, nil, "", ""), 401)
	// Wrong-code attempts commit independently; the sixth attempt remains blocked.
	email := uuid.NewString() + "@example.com"
	emails = append(emails, email)
	if err := svc.SendCode(ctx, email); err != nil {
		t.Fatal(err)
	}
	for range 5 {
		_, err := svc.VerifyCode(ctx, email, "000000", "test")
		if err == nil {
			t.Fatal("bad verification code accepted")
		}
	}
	if _, err := svc.VerifyCode(ctx, email, "123456", "test"); err == nil {
		t.Fatal("attempt limit was bypassed")
	}
	if err := svc.SendCode(ctx, email); err != service.ErrRateLimited {
		t.Fatalf("resend cooldown: %v", err)
	}
	// A browser login receives HttpOnly cookies, never a readable JWT response.
	email = uuid.NewString() + "@example.com"
	emails = append(emails, email)
	if err := svc.SendCode(ctx, email); err != nil {
		t.Fatal(err)
	}
	browser := request("POST", "/api/auth/verify-code", fmt.Sprintf(`{"email":%q,"code":"123456"}`, email), "", nil, "", "http://localhost:3000")
	requireStatus(browser, 200)
	if strings.Contains(browser.Body.String(), `"token"`) {
		t.Fatal("browser response exposed JWT")
	}
	found := false
	for _, cookie := range browser.Result().Cookies() {
		if cookie.Name == auth.CookieName {
			found = cookie.HttpOnly && cookie.SameSite == http.SameSiteStrictMode
		}
	}
	if !found {
		t.Fatal("missing protected auth cookie")
	}
}
