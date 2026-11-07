package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/Julian-Huang-1/nb-hub/server/internal/auth"
	"github.com/Julian-Huang-1/nb-hub/server/internal/service"
	"net/http"
	"strings"
	"sync"
	"time"
)

type identityKey struct{}

func Identity(ctx context.Context) service.Identity {
	value, _ := ctx.Value(identityKey{}).(service.Identity)
	return value
}
func reject(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"code": code, "error": message})
}
func Authenticate(s *service.Auth) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			for _, name := range []string{"X-User-ID", "X-User-Email", "X-Agent-ID", "X-Task-ID", "X-Actor-Source"} {
				r.Header.Del(name)
			}
			token, fromCookie := auth.Extract(r)
			if token == "" {
				reject(w, 401, "unauthorized", "Sign in to continue")
				return
			}
			identity, err := s.Authenticate(r.Context(), token)
			if err != nil {
				if errors.Is(err, service.ErrCredentials) {
					reject(w, 401, "unauthorized", "Session or token is invalid or expired")
				} else {
					reject(w, 503, "auth_unavailable", "Authentication is temporarily unavailable")
				}
				return
			}
			if fromCookie && identity.Kind != "session" {
				reject(w, 401, "unauthorized", "Cookies require an interactive session")
				return
			}
			if fromCookie && !auth.ValidateCSRF(r, s.Config.Secret, identity.SessionID) {
				reject(w, 403, "csrf_failed", "CSRF validation failed")
				return
			}
			if fromCookie && (r.Method == http.MethodGet || r.Method == http.MethodHead) {
				renewed, changed, err := s.Renew(r.Context(), identity)
				if err != nil {
					reject(w, 503, "auth_unavailable", "Session renewal failed")
					return
				}
				if changed {
					auth.SetCookies(w, renewed.Token, identity.SessionID, renewed.ExpiresAt, s.Config)
					identity.ExpiresAt = renewed.ExpiresAt
				}
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), identityKey{}, identity)))
		})
	}
}
func CORS(cfg auth.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				allowed := false
				for _, candidate := range cfg.AllowedOrigins {
					allowed = allowed || origin == candidate
				}
				machine := r.Header.Get("X-Auth-Mode") == "bearer" || strings.HasPrefix(r.Header.Get("Authorization"), "Bearer ")
				if r.Method == http.MethodOptions {
					headers := strings.ToLower(r.Header.Get("Access-Control-Request-Headers"))
					machine = machine || strings.Contains(headers, "authorization") || strings.Contains(headers, "x-auth-mode")
				}
				if origin == "null" && machine {
					if _, err := r.Cookie(auth.CookieName); err != nil {
						allowed = true
					}
				}
				if !allowed {
					reject(w, 403, "origin_not_allowed", "Request origin is not allowed")
					return
				}
				w.Header().Add("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Origin", origin)
				if origin != "null" {
					w.Header().Set("Access-Control-Allow-Credentials", "true")
				}
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Auth-Mode")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(204)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// A bounded per-instance limiter supplements the database's per-email cooldown
// and five-attempt limit. It requires no Redis on the small self-hosted instance.
func LoginRateLimit() func(http.Handler) http.Handler {
	var mu sync.Mutex
	window := time.Now()
	count := 0
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mu.Lock()
			if time.Since(window) >= time.Minute {
				window = time.Now()
				count = 0
			}
			count++
			allowed := count <= 60
			mu.Unlock()
			if !allowed {
				w.Header().Set("Retry-After", "60")
				reject(w, 429, "rate_limited", "Too many login attempts; try again later")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
