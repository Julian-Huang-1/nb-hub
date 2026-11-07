package auth

import (
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"
)

const DevSecret = "nb-hub-development-secret-never-use-in-production"

type Config struct {
	Production                                            bool
	Secret                                                []byte
	TTL                                                   time.Duration
	FrontendOrigin                                        string
	AllowedOrigins                                        []string
	AllowSignup                                           bool
	AllowedEmails                                         []string
	AllowedDomains                                        []string
	DevCode                                               string
	SMTPHost, SMTPPort, SMTPUser, SMTPPassword, SMTPFrom  string
	ResendKey, ResendFrom                                 string
	GoogleClientID, GoogleClientSecret, GoogleRedirectURI string
}

func FromEnv() (Config, error) {
	c := Config{Production: strings.EqualFold(os.Getenv("APP_ENV"), "production"),
		Secret: []byte(strings.TrimSpace(os.Getenv("JWT_SECRET"))), TTL: 30 * 24 * time.Hour,
		FrontendOrigin: strings.TrimRight(os.Getenv("FRONTEND_ORIGIN"), "/"),
		AllowedOrigins: split(os.Getenv("CORS_ALLOWED_ORIGINS")),
		AllowSignup:    !strings.EqualFold(strings.TrimSpace(os.Getenv("ALLOW_SIGNUP")), "false"),
		AllowedEmails:  split(os.Getenv("ALLOWED_EMAILS")), AllowedDomains: split(os.Getenv("ALLOWED_EMAIL_DOMAINS")),
		SMTPHost: os.Getenv("SMTP_HOST"), SMTPPort: os.Getenv("SMTP_PORT"), SMTPUser: os.Getenv("SMTP_USERNAME"),
		SMTPPassword: os.Getenv("SMTP_PASSWORD"), SMTPFrom: os.Getenv("SMTP_FROM_EMAIL"),
		ResendKey: os.Getenv("RESEND_API_KEY"), ResendFrom: os.Getenv("RESEND_FROM_EMAIL"),
		GoogleClientID: os.Getenv("GOOGLE_CLIENT_ID"), GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURI: os.Getenv("GOOGLE_REDIRECT_URI"),
	}
	if !c.Production && os.Getenv("APP_ENV") == "development" {
		if len(c.Secret) == 0 {
			c.Secret = []byte(DevSecret)
		}
		c.DevCode = os.Getenv("NB_HUB_DEV_VERIFICATION_CODE")
		if c.FrontendOrigin == "" {
			port := os.Getenv("FRONTEND_PORT")
			if port == "" {
				port = "3000"
			}
			c.FrontendOrigin = "http://localhost:" + port
		}
	}
	if len(c.Secret) < 32 || (c.Production && string(c.Secret) == DevSecret) {
		return c, fmt.Errorf("JWT_SECRET must contain at least 32 bytes and use an independent production secret")
	}
	if raw := os.Getenv("AUTH_TOKEN_TTL"); raw != "" {
		ttl, err := time.ParseDuration(raw)
		if err != nil || ttl < time.Minute || ttl > 90*24*time.Hour {
			return c, fmt.Errorf("AUTH_TOKEN_TTL must be between 1m and 2160h")
		}
		c.TTL = ttl
	}
	origin, err := url.Parse(c.FrontendOrigin)
	if err != nil || origin.Host == "" || (origin.Scheme != "http" && origin.Scheme != "https") || origin.Path != "" || origin.RawQuery != "" || origin.Fragment != "" || origin.User != nil {
		return c, fmt.Errorf("FRONTEND_ORIGIN must be an HTTP(S) origin")
	}
	if c.Production && origin.Scheme != "https" {
		return c, fmt.Errorf("production FRONTEND_ORIGIN must use HTTPS")
	}
	c.AllowedOrigins = append(c.AllowedOrigins, c.FrontendOrigin)
	if !c.Production {
		alias := *origin
		if alias.Hostname() == "localhost" {
			alias.Host = strings.Replace(alias.Host, "localhost", "127.0.0.1", 1)
		} else if alias.Hostname() == "127.0.0.1" {
			alias.Host = strings.Replace(alias.Host, "127.0.0.1", "localhost", 1)
		}
		c.AllowedOrigins = append(c.AllowedOrigins, alias.String())
	}
	if c.DevCode != "" && !ValidCode(c.DevCode) {
		return c, fmt.Errorf("NB_HUB_DEV_VERIFICATION_CODE must be six digits")
	}
	if c.SMTPPort == "" {
		c.SMTPPort = "587"
	}
	if c.GoogleClientID != "" || c.GoogleClientSecret != "" {
		if c.GoogleClientID == "" || c.GoogleClientSecret == "" {
			return c, fmt.Errorf("both Google client ID and secret are required")
		}
		if c.GoogleRedirectURI == "" {
			c.GoogleRedirectURI = c.FrontendOrigin + "/api/auth/google/callback"
		}
		callback, err := url.Parse(c.GoogleRedirectURI)
		if err != nil || callback.Scheme != origin.Scheme || callback.Host != origin.Host || callback.Path != "/api/auth/google/callback" || callback.RawQuery != "" || callback.Fragment != "" || callback.User != nil {
			return c, fmt.Errorf("Google redirect URI must be FRONTEND_ORIGIN/api/auth/google/callback")
		}
	}
	return c, nil
}

func split(s string) []string {
	var result []string
	for _, item := range strings.Split(s, ",") {
		if item = strings.ToLower(strings.TrimSpace(item)); item != "" {
			result = append(result, item)
		}
	}
	return result
}
func ValidCode(s string) bool {
	if len(s) != 6 {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
func (c Config) EmailEnabled() bool {
	return c.SMTPHost != "" || c.ResendKey != "" || (!c.Production && c.DevCode != "")
}
func (c Config) GoogleEnabled() bool { return c.GoogleClientID != "" && c.GoogleClientSecret != "" }
