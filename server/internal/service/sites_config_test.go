package service

import "testing"

func TestSitesDevelopmentDefaults(t *testing.T) {
	for _, key := range []string{"NB_HUB_CONTENT_DOMAIN", "NB_HUB_SITES_ROOT", "NB_HUB_SITES_OWNER_QUOTA_BYTES", "NB_HUB_SITES_TOTAL_QUOTA_BYTES"} {
		t.Setenv(key, "")
	}
	for _, frontend := range []string{"http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"} {
		t.Run(frontend, func(t *testing.T) {
			cfg, err := SitesConfigFromEnv(frontend, false)
			if err != nil {
				t.Fatal(err)
			}
			if cfg.Domain != "sites.localhost:8080" {
				t.Fatalf("unexpected default domain: %s", cfg.Domain)
			}
		})
	}
}

func TestSitesDevelopmentIsolation(t *testing.T) {
	for _, tc := range []struct{ frontend, content string }{
		{"http://sites.localhost:3000", "sites.localhost:8080"},
		{"http://s123.sites.localhost:3000", "sites.localhost:8080"},
		{"http://hub.example.com:3000", "sites.hub.example.com:8080"},
	} {
		cfg := SitesConfig{Domain: tc.content, Scheme: "http"}
		if err := cfg.Validate(tc.frontend, false); err == nil {
			t.Errorf("accepted overlapping hosts: %s and %s", tc.frontend, tc.content)
		}
	}
}

func TestContentDomainIsolation(t *testing.T) {
	for _, domain := range []string{"hub.example.com", "files.example.com", "example.com", "nested.hub.example.com", "https://files.example.net", "files.example.net/path", "*.example.net", "files.example.net?x=1"} {
		t.Run(domain, func(t *testing.T) {
			c := SitesConfig{Domain: domain, Scheme: "https"}
			if err := c.Validate("https://hub.example.com", true); err == nil {
				t.Fatal("unsafe domain accepted")
			}
		})
	}
	if err := (SitesConfig{Domain: "files.example.net", Scheme: "https"}).Validate("https://hub.example.com", true); err != nil {
		t.Fatal(err)
	}
}
