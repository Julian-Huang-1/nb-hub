package api

import (
	"encoding/json"
	"github.com/Julian-Huang-1/nb-hub/server/internal/auth"
	"github.com/Julian-Huang-1/nb-hub/server/internal/handler"
	"github.com/Julian-Huang-1/nb-hub/server/internal/middleware"
	"github.com/Julian-Huang-1/nb-hub/server/internal/service"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
)

type healthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

// Router contains HTTP-only transport wiring. Domain handlers can be added as
// separate packages as the product model is defined.
func Router(log *slog.Logger, authentication ...*service.Auth) http.Handler {
	r := chi.NewRouter()
	if len(authentication) > 0 && authentication[0] != nil {
		s := authentication[0]
		r.Use(middleware.CORS(s.Config))
		h := &handler.Auth{Service: s, Log: log, Google: &auth.GoogleProvider{Config: s.Config}}
		r.Route("/api/auth", func(r chi.Router) {
			r.Use(func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Cache-Control", "no-store")
					next.ServeHTTP(w, r)
				})
			})
			r.Get("/config", h.Config)
			r.Group(func(r chi.Router) {
				r.Use(middleware.LoginRateLimit())
				r.Post("/send-code", h.SendCode)
				r.Post("/verify-code", h.VerifyCode)
				r.Get("/google/start", h.GoogleStart)
				r.Get("/google/callback", h.GoogleCallback)
			})
			r.Group(func(r chi.Router) {
				r.Use(middleware.Authenticate(s))
				r.Get("/me", h.Me)
				r.Post("/logout", h.Logout)
				r.Post("/refresh", h.Refresh)
				r.Get("/sessions", h.Sessions)
				r.Delete("/sessions/{id}", h.RevokeSession)
				r.Get("/tokens", h.PATs)
				r.Post("/tokens", h.CreatePAT)
				r.Delete("/tokens/{id}", h.RevokePAT)
			})
		})
	} else {
		r.Use(cors)
		r.HandleFunc("/api/auth/*", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(503)
			_ = json.NewEncoder(w).Encode(map[string]string{"code": "auth_unavailable", "error": "Authentication requires a configured database"})
		})
	}
	r.Get("/api/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(healthResponse{Status: "ok", Service: "nb-hub-api"})
	})
	r.Get("/api/daemon/ws", func(w http.ResponseWriter, req *http.Request) {
		// The endpoint is local-only until daemon identity and authentication exist.
		if !isLoopback(req.RemoteAddr) {
			http.Error(w, "daemon connection must be local", http.StatusForbidden)
			return
		}
		conn, err := (&websocket.Upgrader{CheckOrigin: func(_ *http.Request) bool { return true }}).Upgrade(w, req, nil)
		if err != nil {
			log.Error("daemon websocket upgrade failed", "error", err)
			return
		}
		defer conn.Close()
		_ = conn.SetReadDeadline(time.Now().Add(45 * time.Second))
		conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(45 * time.Second)) })
		for {
			messageType, payload, err := conn.ReadMessage()
			if err != nil {
				return
			}
			if messageType != websocket.TextMessage || string(payload) != "ping" {
				continue
			}
			if err := conn.WriteMessage(websocket.TextMessage, []byte("pong")); err != nil {
				return
			}
			_ = conn.SetReadDeadline(time.Now().Add(45 * time.Second))
		}
	})
	return r
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Local bootstrap API has no credentials or mutations yet.
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
