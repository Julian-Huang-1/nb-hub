package service

import (
	"context"
	"strings"

	db "github.com/Julian-Huang-1/nb-hub/server/pkg/db/generated"
	"github.com/google/uuid"
)

// ContentTarget describes a site version without exposing database rows to HTTP handlers.
// An unpublished site has a nil DeploymentID but can still exchange access tickets.
type ContentTarget struct {
	SiteID, DeploymentID                uuid.UUID
	Visibility, RoutingMode, Entrypoint string
}

func (s *Sites) ResolveContent(ctx context.Context, id uuid.UUID, preview bool) (ContentTarget, error) {
	var site db.Site
	var version db.Deployment
	var err error
	if preview {
		version, err = s.Queries.GetPreviewDeployment(ctx, id)
		if err != nil {
			return ContentTarget{}, siteError(err)
		}
		site, err = s.Queries.GetContentSite(ctx, version.SiteID)
	} else {
		site, err = s.Queries.GetContentSite(ctx, id)
	}
	if err != nil {
		return ContentTarget{}, siteError(err)
	}
	target := ContentTarget{SiteID: site.ID, Visibility: site.Visibility, RoutingMode: site.RoutingMode}
	if !preview {
		if !site.CurrentDeploymentID.Valid {
			return target, nil
		}
		version, err = s.Queries.GetDeployment(ctx, db.GetDeploymentParams{SiteID: site.ID, ID: uuid.UUID(site.CurrentDeploymentID.Bytes)})
		if err != nil {
			return ContentTarget{}, siteError(err)
		}
	}
	if version.Status != "ready" {
		return ContentTarget{}, ErrNotFound
	}
	target.DeploymentID = version.ID
	target.Entrypoint = version.Entrypoint
	return target, nil
}

// ResolveContentHost rejects arbitrary wildcard names before certificate issuance
// and before serving files. Only an active persisted site/version is eligible.
func (s *Sites) ResolveContentHost(ctx context.Context, host string) (ContentTarget, bool, error) {
	host = strings.ToLower(host)
	suffix := "." + s.Config.Domain
	if !strings.HasSuffix(host, suffix) {
		return ContentTarget{}, false, ErrNotFound
	}
	label := strings.TrimSuffix(host, suffix)
	if len(label) != 33 || (label[0] != 's' && label[0] != 'p') {
		return ContentTarget{}, false, ErrNotFound
	}
	id, err := uuid.Parse(label[1:])
	if err != nil {
		return ContentTarget{}, false, ErrNotFound
	}
	preview := label[0] == 'p'
	target, err := s.ResolveContent(ctx, id, preview)
	return target, preview, err
}
