package auth

import (
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"testing"
	"time"
)

func TestSessionTokenValidation(t *testing.T) {
	secret := []byte("test-key-with-at-least-32-bytes-long")
	user, session := uuid.New(), uuid.New()
	token, err := Sign(secret, user, session, time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	claims, err := Parse(secret, token)
	if err != nil || claims.Subject != user.String() || claims.SessionID != session {
		t.Fatalf("claims=%+v err=%v", claims, err)
	}
	expired, _ := Sign(secret, user, session, time.Now().Add(-time.Minute))
	unsigned, _ := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{"sub": user.String(), "sid": session.String(), "exp": time.Now().Add(time.Hour).Unix()}).SignedString(jwt.UnsafeAllowNoneSignatureType)
	for _, raw := range []string{expired, unsigned, "not-a-token"} {
		if _, err := Parse(secret, raw); err == nil {
			t.Fatalf("accepted invalid token: %s", raw)
		}
	}
	if _, err := Parse([]byte("a-different-key"), token); err == nil {
		t.Fatal("wrong key accepted")
	}
}
func TestProductionConfiguration(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("FRONTEND_ORIGIN", "https://hub.example.com")
	t.Setenv("JWT_SECRET", DevSecret)
	if _, err := FromEnv(); err == nil {
		t.Fatal("development signing key accepted in production")
	}
	t.Setenv("JWT_SECRET", "production-key-at-least-32-bytes-long")
	t.Setenv("NB_HUB_DEV_VERIFICATION_CODE", "888888")
	cfg, err := FromEnv()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DevCode != "" {
		t.Fatal("production enabled development verification code")
	}
}
