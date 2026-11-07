package auth

import (
	"crypto/hmac"
	"github.com/google/uuid"
	"net/http"
	"time"
)

const CookieName = "nbhub_auth"
const CSRFCookie = "nbhub_csrf"

func SetCookies(w http.ResponseWriter, token string, sid uuid.UUID, expires time.Time, cfg Config) {
	age := max(1, int(time.Until(expires).Seconds()))
	http.SetCookie(w, &http.Cookie{Name: CookieName, Value: token, Path: "/", HttpOnly: true, Secure: cfg.Production, SameSite: http.SameSiteStrictMode, Expires: expires, MaxAge: age})
	http.SetCookie(w, &http.Cookie{Name: CSRFCookie, Value: CSRF(cfg.Secret, sid), Path: "/", Secure: cfg.Production, SameSite: http.SameSiteStrictMode, Expires: expires, MaxAge: age})
}

func ClearCookies(w http.ResponseWriter, secure bool) {
	for _, name := range []string{CookieName, CSRFCookie} {
		http.SetCookie(w, &http.Cookie{Name: name, Value: "", Path: "/", HttpOnly: name == CookieName, Secure: secure, SameSite: http.SameSiteStrictMode, MaxAge: -1, Expires: time.Unix(1, 0)})
	}
}
func Extract(r *http.Request) (string, bool) {
	if value := r.Header.Get("Authorization"); value != "" {
		const prefix = "Bearer "
		if len(value) <= len(prefix) || value[:len(prefix)] != prefix {
			return "", false
		}
		return value[len(prefix):], false
	}
	cookie, err := r.Cookie(CookieName)
	if err == nil {
		return cookie.Value, true
	}
	return "", false
}
func ValidateCSRF(r *http.Request, secret []byte, sid uuid.UUID) bool {
	if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
		return true
	}
	cookie, err := r.Cookie(CSRFCookie)
	if err != nil {
		return false
	}
	expected := []byte(CSRF(secret, sid))
	return hmac.Equal(expected, []byte(cookie.Value)) && hmac.Equal(expected, []byte(r.Header.Get("X-CSRF-Token")))
}
