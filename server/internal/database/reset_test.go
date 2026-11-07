package database

import "testing"

func TestResetConfig(t *testing.T) {
	const local = "postgres://dev:dev@127.0.0.1:5432/nbhub_dev?sslmode=disable"
	tests := []struct {
		name, env, url, confirmation string
		allowed                      bool
	}{
		{"development", "development", local, "nbhub_dev", true},
		{"IPv6 loopback", "development", "postgres://dev:dev@[::1]:5432/nbhub_dev", "nbhub_dev", true},
		{"production environment", "production", local, "nbhub_dev", false},
		{"missing environment", "", local, "nbhub_dev", false},
		{"missing confirmation", "development", local, "", false},
		{"missing URL", "development", "", "nbhub_dev", false},
		{"remote host", "development", "postgres://dev:dev@prod.example/nbhub_dev", "nbhub_dev", false},
		{"production database", "development", "postgres://dev:dev@127.0.0.1/nbhub_prod", "nbhub_dev", false},
		{"host query override", "development", local + "&host=prod.example", "nbhub_dev", false},
		{"database query override", "development", local + "&dbname=nbhub_prod", "nbhub_dev", false},
		{"remote fallback", "development", "postgres://dev:dev@127.0.0.1,prod.example/nbhub_dev", "nbhub_dev", false},
		{"socket", "development", "host=/var/run/postgresql dbname=nbhub_dev", "nbhub_dev", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := resetConfig(tt.env, tt.url, tt.confirmation)
			if (err == nil) != tt.allowed {
				t.Fatalf("allowed=%v, error=%v", tt.allowed, err)
			}
		})
	}
}
