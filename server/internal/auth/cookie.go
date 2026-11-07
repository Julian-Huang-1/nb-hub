package auth

import (
	"crypto/hmac"
	"github.com/google/uuid"
	"net/http"
	"time"
)

const CookieName = "nbhub_auth"
const CSRFCookie = "nbhub_csrf"

func SessionCookieName(production bool) string {
	if production {
		return "__Host-" + CookieName
	}
	return CookieName
}
func CSRFCookieName(production bool) string {
	if production {
		return "__Host-" + CSRFCookie
	}
	return CSRFCookie
}

func GoogleCookieName(production bool) string {
	if production {
		return "__Host-" + GoogleCookie
	}
	return GoogleCookie
}

func SetCookies(w http.ResponseWriter, token string, sid uuid.UUID, expires time.Time, cfg Config) {
	age := max(1, int(time.Until(expires).Seconds()))
	http.SetCookie(w, &http.Cookie{Name: SessionCookieName(cfg.Production), Value: token, Path: "/", HttpOnly: true, Secure: cfg.Production, SameSite: http.SameSiteStrictMode, Expires: expires, MaxAge: age})
	http.SetCookie(w, &http.Cookie{Name: CSRFCookieName(cfg.Production), Value: CSRF(cfg.Secret, sid), Path: "/", Secure: cfg.Production, SameSite: http.SameSiteStrictMode, Expires: expires, MaxAge: age})
}

func ClearCookies(w http.ResponseWriter, secure bool) {
	for _, name := range []string{SessionCookieName(secure), CSRFCookieName(secure)} {
		http.SetCookie(w, &http.Cookie{Name: name, Value: "", Path: "/", HttpOnly: name == SessionCookieName(secure), Secure: secure, SameSite: http.SameSiteStrictMode, MaxAge: -1, Expires: time.Unix(1, 0)})
	}
}
func Extract(r *http.Request, production bool) (string, bool) {
	if value := r.Header.Get("Authorization"); value != "" {
		const prefix = "Bearer "
		if len(value) <= len(prefix) || value[:len(prefix)] != prefix {
			return "", false
		}
		return value[len(prefix):], false
	}
	cookie, err := r.Cookie(SessionCookieName(production))
	if err == nil {
		return cookie.Value, true
	}
	return "", false
}
func ValidateCSRF(r *http.Request, secret []byte, sid uuid.UUID, production bool) bool {
	if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
		return true
	}
	cookie, err := r.Cookie(CSRFCookieName(production))
	if err != nil {
		return false
	}
	expected := []byte(CSRF(secret, sid))
	return hmac.Equal(expected, []byte(cookie.Value)) && hmac.Equal(expected, []byte(r.Header.Get("X-CSRF-Token")))
}
