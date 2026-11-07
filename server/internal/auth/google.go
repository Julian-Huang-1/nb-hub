package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const GoogleCookie = "nbhub_google_state"

type GoogleProvider struct {
	Config Config
	Client *http.Client
}
type googleState struct {
	State    string `json:"state"`
	Verifier string `json:"verifier"`
	Expires  int64  `json:"expires"`
}
type GoogleUser struct {
	Subject  string `json:"sub"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Verified bool   `json:"email_verified"`
}

func (p *GoogleProvider) Start() (string, string, error) {
	state, err := RandomToken("")
	if err != nil {
		return "", "", err
	}
	verifier, err := RandomToken("")
	if err != nil {
		return "", "", err
	}
	encoded, _ := json.Marshal(googleState{state, verifier, time.Now().Add(10 * time.Minute).Unix()})
	payload := base64.RawURLEncoding.EncodeToString(encoded)
	cookie := payload + "." + hex.EncodeToString(Digest(p.Config.Secret, "google:"+payload))
	challenge := sha256.Sum256([]byte(verifier))
	values := url.Values{"client_id": {p.Config.GoogleClientID}, "redirect_uri": {p.Config.GoogleRedirectURI}, "response_type": {"code"}, "scope": {"openid email profile"}, "state": {state}, "code_challenge": {base64.RawURLEncoding.EncodeToString(challenge[:])}, "code_challenge_method": {"S256"}}
	return "https://accounts.google.com/o/oauth2/v2/auth?" + values.Encode(), cookie, nil
}
func (p *GoogleProvider) Finish(ctx context.Context, cookie, state, code string) (GoogleUser, error) {
	invalid := errors.New("invalid Google login state")
	pieces := strings.Split(cookie, ".")
	if len(pieces) != 2 || code == "" {
		return GoogleUser{}, invalid
	}
	signature, err := hex.DecodeString(pieces[1])
	if err != nil || !hmac.Equal(signature, Digest(p.Config.Secret, "google:"+pieces[0])) {
		return GoogleUser{}, invalid
	}
	payload, err := base64.RawURLEncoding.DecodeString(pieces[0])
	if err != nil {
		return GoogleUser{}, invalid
	}
	var saved googleState
	if json.Unmarshal(payload, &saved) != nil || saved.Expires <= time.Now().Unix() || !hmac.Equal([]byte(state), []byte(saved.State)) {
		return GoogleUser{}, invalid
	}
	values := url.Values{"client_id": {p.Config.GoogleClientID}, "client_secret": {p.Config.GoogleClientSecret}, "redirect_uri": {p.Config.GoogleRedirectURI}, "grant_type": {"authorization_code"}, "code": {code}, "code_verifier": {saved.Verifier}}
	request, err := http.NewRequestWithContext(ctx, "POST", "https://oauth2.googleapis.com/token", strings.NewReader(values.Encode()))
	if err != nil {
		return GoogleUser{}, err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := p.Client
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	response, err := client.Do(request)
	if err != nil {
		return GoogleUser{}, err
	}
	defer response.Body.Close()
	var tokens struct {
		AccessToken string `json:"access_token"`
	}
	if response.StatusCode != 200 || json.NewDecoder(io.LimitReader(response.Body, 65536)).Decode(&tokens) != nil || tokens.AccessToken == "" {
		return GoogleUser{}, errors.New("Google code exchange failed")
	}
	request, err = http.NewRequestWithContext(ctx, "GET", "https://openidconnect.googleapis.com/v1/userinfo", nil)
	if err != nil {
		return GoogleUser{}, err
	}
	request.Header.Set("Authorization", "Bearer "+tokens.AccessToken)
	response, err = client.Do(request)
	if err != nil {
		return GoogleUser{}, err
	}
	defer response.Body.Close()
	var user GoogleUser
	if response.StatusCode != 200 || json.NewDecoder(io.LimitReader(response.Body, 65536)).Decode(&user) != nil || !user.Verified || user.Subject == "" || user.Email == "" {
		return GoogleUser{}, errors.New("Google account must have a verified email")
	}
	return user, nil
}
