package api

import (
	"encoding/json"
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
func Router(log *slog.Logger) http.Handler {
	r := chi.NewRouter()
	r.Use(cors)
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
