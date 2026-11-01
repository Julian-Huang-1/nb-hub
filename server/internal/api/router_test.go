package api

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/websocket"
)

func TestHealth(t *testing.T) {
	recorder := httptest.NewRecorder()
	Router(slog.New(slog.NewTextHandler(io.Discard, nil))).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/health", nil))
	if recorder.Code != http.StatusOK || recorder.Body.String() != "{\"status\":\"ok\",\"service\":\"nb-hub-api\"}\n" {
		t.Fatalf("unexpected health response: %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestDaemonWebSocket(t *testing.T) {
	server := httptest.NewServer(Router(slog.New(slog.NewTextHandler(io.Discard, nil))))
	defer server.Close()
	conn, _, err := websocket.DefaultDialer.Dial("ws"+server.URL[len("http"):]+"/api/daemon/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	if err := conn.WriteMessage(websocket.TextMessage, []byte("ping")); err != nil {
		t.Fatal(err)
	}
	_, body, err := conn.ReadMessage()
	if err != nil || string(body) != "pong" {
		t.Fatalf("unexpected daemon response: %q %v", body, err)
	}
}
