package service

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"

	"golang.org/x/net/publicsuffix"
)

type SitesConfig struct {
	Root, Domain, Scheme   string
	OwnerQuota, TotalQuota int64
}

func SitesConfigFromEnv(frontend string, production bool) (SitesConfig, error) {
	c := SitesConfig{Root: os.Getenv("NB_HUB_SITES_ROOT"), Domain: strings.ToLower(os.Getenv("NB_HUB_CONTENT_DOMAIN")), Scheme: "http", OwnerQuota: 1 << 30, TotalQuota: 5 << 30}
	if c.Root == "" {
		c.Root = ".nb-hub/sites"
	}
	if c.Domain == "" {
		if production {
			return c, fmt.Errorf("NB_HUB_CONTENT_DOMAIN is required when sites are enabled")
		}
		c.Domain = "sites.localhost:8080"
	}
	if production {
		c.Scheme = "https"
	}
	for key, target := range map[string]*int64{"NB_HUB_SITES_OWNER_QUOTA_BYTES": &c.OwnerQuota, "NB_HUB_SITES_TOTAL_QUOTA_BYTES": &c.TotalQuota} {
		if value := os.Getenv(key); value != "" {
			n, err := strconv.ParseInt(value, 10, 64)
			if err != nil || n < 70<<20 || n > 1<<40 {
				return c, fmt.Errorf("%s must be between 70 MiB and 1 TiB", key)
			}
			*target = n
		}
	}
	if err := c.Validate(frontend, production); err != nil {
		return c, err
	}
	return c, nil
}
func (c SitesConfig) Validate(frontend string, production bool) error {
	u, err := url.Parse(c.Scheme + "://" + c.Domain)
	if err != nil || u.Host != c.Domain || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || strings.Contains(c.Domain, "*") {
		return fmt.Errorf("invalid content domain")
	}
	host := u.Hostname()
	if net.ParseIP(host) != nil || host == "" || len(host) > 219 {
		return fmt.Errorf("content domain must be a DNS hostname")
	}
	for _, label := range strings.Split(host, ".") {
		if label == "" || len(label) > 63 || strings.Trim(label, "abcdefghijklmnopqrstuvwxyz0123456789-") != "" || strings.HasPrefix(label, "-") || strings.HasSuffix(label, "-") {
			return fmt.Errorf("invalid content hostname")
		}
	}
	if port := u.Port(); port != "" {
		n, err := strconv.Atoi(port)
		if err != nil || n < 1 || n > 65535 || production {
			return fmt.Errorf("content ports are only supported in development")
		}
	}
	f, err := url.Parse(frontend)
	if err != nil || f.Hostname() == "" {
		return fmt.Errorf("invalid management origin")
	}
	fh := strings.ToLower(f.Hostname())
	// The default development hosts are localhost and sites.localhost. Permit
	// that loopback-only pairing while retaining hostname isolation and the
	// stricter registrable-domain boundary in production.
	managementIP := net.ParseIP(fh)
	localDevelopment := !production && (fh == "localhost" || managementIP != nil && managementIP.IsLoopback()) && strings.HasSuffix(host, ".localhost")
	if fh == host || !localDevelopment && (strings.HasSuffix(fh, "."+host) || strings.HasSuffix(host, "."+fh)) {
		return fmt.Errorf("content domain must be separate from the management domain")
	}
	if production {
		managementRoot, e1 := publicsuffix.EffectiveTLDPlusOne(fh)
		contentRoot, e2 := publicsuffix.EffectiveTLDPlusOne(host)
		if e1 != nil || e2 != nil || managementRoot == contentRoot {
			return fmt.Errorf("production content must use a different registrable domain")
		}
	}
	if production && c.Scheme != "https" {
		return fmt.Errorf("production content requires HTTPS")
	}
	return nil
}
