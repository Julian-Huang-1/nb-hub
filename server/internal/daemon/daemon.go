package daemon

import (
	"context"
	"log/slog"
	"net/url"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

func websocketURL(apiURL string) (string, error) {
	u, err := url.Parse(strings.TrimRight(apiURL, "/"))
	if err != nil {
		return "", err
	}
	if u.Scheme == "https" {
		u.Scheme = "wss"
	} else {
		u.Scheme = "ws"
	}
	u.Path = "/api/daemon/ws"
	return u.String(), nil
}

// Run maintains the transport connection. Task claiming and agent execution
// will be attached here when the first task workflow is defined.
func Run(ctx context.Context, apiURL string, log *slog.Logger) error {
	address, err := websocketURL(apiURL)
	if err != nil {
		return err
	}
	for ctx.Err() == nil {
		conn, _, err := websocket.DefaultDialer.DialContext(ctx, address, nil)
		if err != nil {
			log.Warn("daemon connection failed", "error", err)
		} else {
			log.Info("daemon connected", "address", address)
			keepConnected(ctx, conn, log)
		}
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(3 * time.Second):
		}
	}
	return nil
}

func keepConnected(ctx context.Context, conn *websocket.Conn, log *slog.Logger) {
	defer conn.Close()
	for ctx.Err() == nil {
		if err := conn.WriteMessage(websocket.TextMessage, []byte("ping")); err != nil {
			log.Warn("daemon disconnected", "error", err)
			return
		}
		_ = conn.SetReadDeadline(time.Now().Add(10 * time.Second))
		_, payload, err := conn.ReadMessage()
		if err != nil || string(payload) != "pong" {
			log.Warn("daemon heartbeat failed", "error", err)
			return
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(15 * time.Second):
		}
	}
}
