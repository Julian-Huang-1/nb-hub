package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"time"
)

type Claims struct {
	SessionID uuid.UUID `json:"sid"`
	jwt.RegisteredClaims
}

func RandomToken(prefix string) (string, error) {
	var value [32]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	return prefix + hex.EncodeToString(value[:]), nil
}
func HashToken(token string) []byte { hash := sha256.Sum256([]byte(token)); return hash[:] }
func Digest(secret []byte, value string) []byte {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(value))
	return mac.Sum(nil)
}
func CSRF(secret []byte, session uuid.UUID) string {
	return hex.EncodeToString(Digest(secret, "csrf:"+session.String()))
}
func Sign(secret []byte, user, session uuid.UUID, expires time.Time) (string, error) {
	claims := Claims{SessionID: session, RegisteredClaims: jwt.RegisteredClaims{
		Issuer: "nb-hub", Audience: jwt.ClaimStrings{"nb-hub-clients"}, Subject: user.String(),
		IssuedAt: jwt.NewNumericDate(time.Now()), ExpiresAt: jwt.NewNumericDate(expires),
	}}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}
func Parse(secret []byte, raw string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(token *jwt.Token) (any, error) { return secret, nil },
		jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer("nb-hub"), jwt.WithAudience("nb-hub-clients"), jwt.WithExpirationRequired(), jwt.WithIssuedAt())
	if err != nil || !token.Valid || claims.SessionID == uuid.Nil {
		return nil, errors.New("invalid session")
	}
	if _, err := uuid.Parse(claims.Subject); err != nil {
		return nil, errors.New("invalid session subject")
	}
	return claims, nil
}
