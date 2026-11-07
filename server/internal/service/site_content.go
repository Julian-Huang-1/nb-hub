package service

import (
	"context"

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
