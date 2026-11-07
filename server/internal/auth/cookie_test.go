package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestProductionCookiesCannotBeInjectedBySiblingDomains(t *testing.T) {
	sid := uuid.New()
	secret := []byte("cookie-test-secret")
	w := httptest.NewRecorder()
	SetCookies(w, "session-token", sid, time.Now().Add(time.Hour), Config{Production: true, Secret: secret})
	cookies := w.Result().Cookies()
	if len(cookies) != 2 {
		t.Fatal("missing cookies")
	}
	for _, c := range cookies {
		if !c.Secure || c.Domain != "" || c.Path != "/" {
			t.Fatalf("invalid host-only cookie attributes: %s", c.Name)
		}
	}
	if cookies[0].Name != "__Host-nbhub_auth" || !cookies[0].HttpOnly || cookies[1].Name != "__Host-nbhub_csrf" {
		t.Fatal("missing protected names")
	}
	injected := httptest.NewRequest("POST", "https://hub.example.com/api/auth/tokens", nil)
	injected.AddCookie(&http.Cookie{Name: CookieName, Value: "injected-token"})
	injected.AddCookie(&http.Cookie{Name: CSRFCookie, Value: CSRF(secret, sid)})
	injected.Header.Set("X-CSRF-Token", CSRF(secret, sid))
	if token, _ := Extract(injected, true); token != "" {
		t.Fatal("accepted an unprefixed production cookie")
	}
	if ValidateCSRF(injected, secret, sid, true) {
		t.Fatal("accepted an injected CSRF cookie")
	}
	for _, c := range cookies {
		injected.AddCookie(c)
	}
	if token, fromCookie := Extract(injected, true); token != "session-token" || !fromCookie {
		t.Fatal("protected cookie not selected")
	}
	if !ValidateCSRF(injected, secret, sid, true) {
		t.Fatal("protected CSRF cookie rejected")
	}
	injected.Header.Set("Authorization", "Bearer machine-token")
	if token, fromCookie := Extract(injected, true); token != "machine-token" || fromCookie {
		t.Fatal("bearer must retain precedence")
	}
}
func TestDevelopmentCookieNamesRemainCompatible(t *testing.T) {
	w := httptest.NewRecorder()
	SetCookies(w, "token", uuid.New(), time.Now().Add(time.Hour), Config{})
	for _, c := range w.Result().Cookies() {
		if c.Secure || (c.Name != CookieName && c.Name != CSRFCookie) {
			t.Fatal("development cookies changed")
		}
	}
}
