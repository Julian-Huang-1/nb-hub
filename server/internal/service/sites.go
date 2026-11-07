package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Julian-Huang-1/nb-hub/server/internal/storage"
	db "github.com/Julian-Huang-1/nb-hub/server/pkg/db/generated"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound            = errors.New("site or deployment not found")
	ErrPublicationConflict = errors.New("publication_conflict")
	ErrIdempotencyConflict = errors.New("idempotency_conflict")
	ErrQuota               = errors.New("site or storage quota exceeded")
	ErrNotReady            = errors.New("deployment is not ready")
)

type Sites struct {
	Pool    *pgxpool.Pool
	Queries *db.Queries
	Storage *storage.Local
	Config  SitesConfig
}

func NewSites(pool *pgxpool.Pool, store *storage.Local, cfg SitesConfig) *Sites {
	return &Sites{pool, db.New(pool), store, cfg}
}

type Site struct {
	ID                  uuid.UUID  `json:"id"`
	Name                string     `json:"name"`
	Visibility          string     `json:"visibility"`
	RoutingMode         string     `json:"routing_mode"`
	Revision            int64      `json:"revision"`
	CurrentDeploymentID *uuid.UUID `json:"current_deployment_id"`
	URL                 string     `json:"url"`
	CreatedAt           time.Time  `json:"created_at"`
}
type Deployment struct {
	ID           uuid.UUID `json:"id"`
	SiteID       uuid.UUID `json:"site_id"`
	Status       string    `json:"status"`
	Entrypoint   string    `json:"entrypoint"`
	Message      string    `json:"message"`
	ErrorCode    string    `json:"error_code,omitempty"`
	StorageBytes int64     `json:"storage_bytes"`
	PreviewURL   string    `json:"preview_url"`
	StatusURL    string    `json:"status_url"`
	CreatedAt    time.Time `json:"created_at"`
}

func (s *Sites) Host(site uuid.UUID, preview *uuid.UUID) string {
	label := "s" + strings.ReplaceAll(site.String(), "-", "")
	if preview != nil {
		label = "p" + strings.ReplaceAll(preview.String(), "-", "")
	}
	return label + "." + s.Config.Domain
}
func (s *Sites) SiteResponse(v db.Site) Site {
	var current *uuid.UUID
	if v.CurrentDeploymentID.Valid {
		id := uuid.UUID(v.CurrentDeploymentID.Bytes)
		current = &id
	}
	return Site{v.ID, v.Name, v.Visibility, v.RoutingMode, v.Revision, current, s.Config.Scheme + "://" + s.Host(v.ID, nil) + "/", v.CreatedAt}
}
func (s *Sites) DeploymentResponse(v db.Deployment) Deployment {
	return Deployment{v.ID, v.SiteID, v.Status, v.Entrypoint, v.Message, v.ErrorCode, v.StorageBytes, s.Config.Scheme + "://" + s.Host(v.SiteID, &v.ID) + "/", "/api/v1/sites/" + v.SiteID.String() + "/deployments/" + v.ID.String(), v.CreatedAt}
}
func siteError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}
func ValidSite(name, visibility, routing string) bool {
	return utf8.ValidString(name) && !strings.ContainsRune(name, 0) && len([]rune(strings.TrimSpace(name))) >= 1 && len([]rune(name)) <= 80 && (visibility == "public" || visibility == "private") && (routing == "static" || routing == "spa")
}
func (s *Sites) Create(ctx context.Context, owner uuid.UUID, name, visibility, routing string) (Site, error) {
	if !ValidSite(name, visibility, routing) {
		return Site{}, ErrInvalidInput
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return Site{}, err
	}
	defer tx.Rollback(ctx)
	q := s.Queries.WithTx(tx)
	if _, err = q.LockSiteOwner(ctx, owner); err != nil {
		return Site{}, err
	}
	n, err := q.CountOwnerSites(ctx, owner)
	if err != nil {
		return Site{}, err
	}
	if n >= 50 {
		return Site{}, ErrQuota
	}
	v, err := q.CreateSite(ctx, db.CreateSiteParams{ID: uuid.New(), OwnerID: owner, Name: strings.TrimSpace(name), Visibility: visibility, RoutingMode: routing})
	if err != nil {
		return Site{}, err
	}
	return s.SiteResponse(v), tx.Commit(ctx)
}
func (s *Sites) Get(ctx context.Context, owner, id uuid.UUID) (Site, error) {
	v, err := s.Queries.GetOwnedSite(ctx, db.GetOwnedSiteParams{ID: id, OwnerID: owner})
	return s.SiteResponse(v), siteError(err)
}
func (s *Sites) List(ctx context.Context, owner uuid.UUID, limit, offset int32) ([]Site, error) {
	rows, err := s.Queries.ListSites(ctx, db.ListSitesParams{OwnerID: owner, Limit: limit, Offset: offset})
	out := make([]Site, 0, len(rows))
	for _, r := range rows {
		out = append(out, s.SiteResponse(r))
	}
	return out, err
}
func (s *Sites) Update(ctx context.Context, owner, id uuid.UUID, name, visibility, routing string, revision int64) (Site, error) {
	if !ValidSite(name, visibility, routing) || revision < 0 {
		return Site{}, ErrInvalidInput
	}
	if _, err := s.Get(ctx, owner, id); err != nil {
		return Site{}, err
	}
	v, err := s.Queries.UpdateSite(ctx, db.UpdateSiteParams{ID: id, OwnerID: owner, Name: strings.TrimSpace(name), Visibility: visibility, RoutingMode: routing, Revision: revision})
	if errors.Is(err, pgx.ErrNoRows) {
		return Site{}, ErrPublicationConflict
	}
	return s.SiteResponse(v), err
}
func (s *Sites) Delete(ctx context.Context, owner, id uuid.UUID) error {
	n, err := s.Queries.DeleteSite(ctx, db.DeleteSiteParams{ID: id, OwnerID: owner})
	if err == nil && n == 0 {
		return ErrNotFound
	}
	return err
}
func (s *Sites) Publish(ctx context.Context, owner, id uuid.UUID, target *uuid.UUID, revision int64) (Site, error) {
	if revision < 0 {
		return Site{}, ErrInvalidInput
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return Site{}, err
	}
	defer tx.Rollback(ctx)
	q := s.Queries.WithTx(tx)
	site, err := q.LockOwnedSite(ctx, db.LockOwnedSiteParams{ID: id, OwnerID: owner})
	if err != nil {
		return Site{}, siteError(err)
	}
	if site.Revision != revision {
		return Site{}, ErrPublicationConflict
	}
	var selected pgtype.UUID
	if target != nil {
		d, err := q.GetDeployment(ctx, db.GetDeploymentParams{SiteID: id, ID: *target})
		if err != nil {
			return Site{}, siteError(err)
		}
		if d.Status != "ready" {
			return Site{}, ErrNotReady
		}
		selected = pgtype.UUID{Bytes: *target, Valid: true}
	}
	v, err := q.PublishSite(ctx, db.PublishSiteParams{ID: id, OwnerID: owner, Revision: revision, DeploymentID: selected})
	if err != nil {
		return Site{}, err
	}
	return s.SiteResponse(v), tx.Commit(ctx)
}
func (s *Sites) GetDeployment(ctx context.Context, owner, site, id uuid.UUID) (Deployment, error) {
	if _, err := s.Get(ctx, owner, site); err != nil {
		return Deployment{}, err
	}
	d, err := s.Queries.GetDeployment(ctx, db.GetDeploymentParams{SiteID: site, ID: id})
	return s.DeploymentResponse(d), siteError(err)
}
func (s *Sites) ListDeployments(ctx context.Context, owner, site uuid.UUID, limit, offset int32) ([]Deployment, error) {
	if _, err := s.Get(ctx, owner, site); err != nil {
		return nil, err
	}
	rows, err := s.Queries.ListDeployments(ctx, db.ListDeploymentsParams{SiteID: site, Limit: limit, Offset: offset})
	out := make([]Deployment, 0, len(rows))
	for _, r := range rows {
		out = append(out, s.DeploymentResponse(r))
	}
	return out, err
}

func (s *Sites) Upload(ctx context.Context, owner, site uuid.UUID, format, entry, message, key string, r io.Reader) (Deployment, error) {
	if !storage.ValidPath(entry) || !utf8.ValidString(message) || strings.ContainsRune(message, 0) || !utf8.ValidString(key) || strings.ContainsRune(key, 0) || len(message) > 1000 || len(key) > 128 || (format != "html" && format != "zip") {
		return Deployment{}, ErrInvalidInput
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return Deployment{}, err
	}
	defer tx.Rollback(ctx)
	q := s.Queries.WithTx(tx)
	if err = q.LockStorageQuota(ctx); err != nil {
		return Deployment{}, err
	}
	if _, err = q.LockSiteOwner(ctx, owner); err != nil {
		return Deployment{}, err
	}
	if _, err = q.LockOwnedSite(ctx, db.LockOwnedSiteParams{ID: site, OwnerID: owner}); err != nil {
		return Deployment{}, siteError(err)
	}
	if key != "" {
		old, e := q.GetIdempotentDeployment(ctx, db.GetIdempotentDeploymentParams{SiteID: site, IdempotencyKey: pgtype.Text{String: key, Valid: true}})
		if e == nil {
			if old.Status == "uploading" || old.ContentHash == "" {
				return Deployment{}, ErrIdempotencyConflict
			}
			// Release locks while consuming a retry; the deployment is immutable.
			if err := tx.Commit(ctx); err != nil {
				return Deployment{}, err
			}
			hash := sha256.New()
			n, err := io.Copy(hash, io.LimitReader(r, storage.MaxUpload+1))
			if err != nil {
				return Deployment{}, err
			}
			if n > storage.MaxUpload {
				return Deployment{}, storage.ErrUploadTooLarge
			}
			if old.ContentHash != hex.EncodeToString(hash.Sum(nil)) || old.Format != format || old.Entrypoint != entry || old.Message != message {
				return Deployment{}, ErrIdempotencyConflict
			}
			return s.DeploymentResponse(old), nil
		}
		if !errors.Is(e, pgx.ErrNoRows) {
			return Deployment{}, e
		}
	}
	count, err := q.CountOwnerDeployments(ctx, owner)
	if err != nil {
		return Deployment{}, err
	}
	if count >= 1000 {
		return Deployment{}, ErrQuota
	}
	total, err := q.TotalSiteStorage(ctx)
	if err != nil {
		return Deployment{}, err
	}
	used, err := q.OwnerStorage(ctx, owner)
	if err != nil {
		return Deployment{}, err
	}
	reserved := storage.MaxUpload + storage.MaxExpanded
	if used+reserved > s.Config.OwnerQuota || total+reserved > s.Config.TotalQuota {
		return Deployment{}, ErrQuota
	}
	d, err := q.CreateDeployment(ctx, db.CreateDeploymentParams{ID: uuid.New(), SiteID: site, Format: format, Entrypoint: entry, Message: message, IdempotencyKey: pgtype.Text{String: key, Valid: key != ""}, StorageBytes: reserved})
	if err != nil {
		return Deployment{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return Deployment{}, err
	}
	uploadID := d.ID
	success := false
	defer func() {
		if !success {
			cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			s.Storage.RemoveStage(uploadID)
			_ = s.Queries.FailUpload(cleanup, uploadID)
		}
	}()
	hash := sha256.New()
	if err = s.Storage.WriteUpload(ctx, d.ID, io.TeeReader(r, hash)); err != nil {
		return Deployment{}, err
	}
	tx2, err := s.Pool.Begin(ctx)
	if err != nil {
		return Deployment{}, err
	}
	defer tx2.Rollback(ctx)
	q = s.Queries.WithTx(tx2)
	if _, err = q.LockOwnedSite(ctx, db.LockOwnedSiteParams{ID: site, OwnerID: owner}); err != nil {
		return Deployment{}, siteError(err)
	}
	d, err = q.QueueDeployment(ctx, db.QueueDeploymentParams{ID: d.ID, ContentHash: hex.EncodeToString(hash.Sum(nil))})
	if err != nil {
		return Deployment{}, err
	}
	if err = q.CreateDeploymentJob(ctx, d.ID); err != nil {
		return Deployment{}, err
	}
	if err = tx2.Commit(ctx); err != nil {
		return Deployment{}, err
	}
	success = true
	return s.DeploymentResponse(d), nil
}
