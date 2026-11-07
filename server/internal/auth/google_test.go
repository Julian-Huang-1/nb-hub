package auth

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestGoogleStateAndVerifiedEmail(t *testing.T) {
	calls := 0
	verified := true
	provider := &GoogleProvider{Config: Config{Secret: []byte("test-signing-key-at-least-32-bytes"), GoogleClientID: "client", GoogleClientSecret: "secret", GoogleRedirectURI: "http://localhost/api/auth/google/callback"}}
	provider.Client = &http.Client{Transport: roundTrip(func(r *http.Request) (*http.Response, error) {
		calls++
		body := `{"access_token":"access"}`
		if r.URL.Host == "oauth2.googleapis.com" {
			r.ParseForm()
			if r.Form.Get("code_verifier") == "" || r.Form.Get("client_secret") != "secret" {
				t.Error("missing PKCE or client credentials")
			}
		} else {
			body = `{"sub":"google-subject","email":"user@example.com","name":"User","email_verified":` + map[bool]string{true: "true", false: "false"}[verified] + `}`
		}
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}, nil
	})}
	location, cookie, err := provider.Start()
	if err != nil {
		t.Fatal(err)
	}
	parsed, _ := url.Parse(location)
	state := parsed.Query().Get("state")
	for _, pair := range [][2]string{{cookie, "wrong-state"}, {cookie + "tampered", state}} {
		if _, err := provider.Finish(context.Background(), pair[0], pair[1], "code"); err == nil {
			t.Fatal("invalid OAuth state accepted")
		}
	}
	if calls != 0 {
		t.Fatal("invalid state reached Google")
	}
	user, err := provider.Finish(context.Background(), cookie, state, "code")
	if err != nil || user.Email != "user@example.com" {
		t.Fatalf("user=%+v err=%v", user, err)
	}
	verified = false
	if _, err := provider.Finish(context.Background(), cookie, state, "code"); err == nil {
		t.Fatal("unverified email accepted")
	}
}
