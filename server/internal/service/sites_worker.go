package service

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/Julian-Huang-1/nb-hub/server/internal/storage"
	db "github.com/Julian-Huang-1/nb-hub/server/pkg/db/generated"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func (s *Sites) RunWorker(ctx context.Context, log *slog.Logger) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	lastCleanup := time.Time{}
	for {
		if ctx.Err() != nil {
			return
		}
		if time.Since(lastCleanup) > time.Minute {
			if err := s.CleanupDeployments(ctx); err != nil {
				log.Error("site cleanup failed", "error", err)
			}
			lastCleanup = time.Now()
		}
		worked, err := s.ProcessDeployment(ctx, log)
		if err != nil && !errors.Is(err, context.Canceled) {
			log.Error("deployment task failed", "error", err)
		}
		if worked && err == nil {
			continue
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
func (s *Sites) ProcessDeployment(ctx context.Context, log *slog.Logger) (bool, error) {
	q := s.Queries
	job, err := q.ClaimDeploymentJob(ctx, pgtype.UUID{Bytes: uuid.New(), Valid: true})
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	d, err := q.StartDeployment(ctx, job.DeploymentID)
	if err != nil {
		return true, err
	}
	buildCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	size, buildErr := s.Storage.Build(buildCtx, d.SiteID, d.ID, d.Format, d.Entrypoint)
	// Interrupted tasks keep their lease and files for a later retry.
	if ctx.Err() != nil {
		return true, ctx.Err()
	}
	if buildErr != nil && !errors.Is(buildErr, storage.ErrInvalidArchive) && job.Attempts < 3 {
		return true, buildErr
	}
	status, code := "ready", ""
	if buildErr != nil {
		status, code, size = "failed", "processing_failed", 0
		if errors.Is(buildErr, storage.ErrInvalidArchive) {
			code = "invalid_archive"
		}
		log.Warn("deployment rejected", "deployment_id", d.ID, "error", buildErr)
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return true, err
	}
	defer tx.Rollback(ctx)
	tq := q.WithTx(tx)
	n, err := tq.FinishDeploymentJob(ctx, db.FinishDeploymentJobParams{DeploymentID: d.ID, LeaseID: job.LeaseID})
	if err != nil {
		return true, err
	}
	if n == 0 {
		return true, nil
	}
	if err = tq.FinishDeployment(ctx, db.FinishDeploymentParams{ID: d.ID, Status: status, ErrorCode: code, StorageBytes: size}); err != nil {
		return true, err
	}
	if err = tx.Commit(ctx); err != nil {
		return true, err
	}
	if status == "failed" {
		if err = s.Storage.RemoveRelease(d.SiteID, d.ID); err != nil {
			return true, err
		}
	}
	return true, s.Storage.RemoveStage(d.ID)
}
func (s *Sites) CleanupDeployments(ctx context.Context) error {
	q := s.Queries
	expired, err := q.ExpireUploads(ctx)
	if err != nil {
		return err
	}
	for _, id := range expired {
		if err = s.Storage.RemoveStage(id); err != nil {
			return err
		}
	}
	deleted, err := q.DeletedSiteArtifacts(ctx)
	if err != nil {
		return err
	}
	for _, d := range deleted {
		if err = s.Storage.RemoveStage(d.ID); err != nil {
			return err
		}
		if err = s.Storage.RemoveRelease(d.SiteID, d.ID); err != nil {
			return err
		}
		if err = q.FinishDeployment(ctx, db.FinishDeploymentParams{ID: d.ID, Status: "failed", ErrorCode: "site_deleted", StorageBytes: 0}); err != nil {
			return err
		}
	}
	if err = q.PruneContentAuth(ctx); err != nil {
		return err
	}
	if err = q.PruneContentSessions(ctx); err != nil {
		return err
	}
	// Build directories can survive a process crash; active builds have a two-minute limit.
	staged, err := os.ReadDir(filepath.Join(s.Storage.Root, "staging"))
	if err != nil {
		return err
	}
	for _, e := range staged {
		id, err := uuid.Parse(e.Name())
		if err != nil {
			continue
		}
		d, err := q.GetAnyDeployment(ctx, id)
		if errors.Is(err, pgx.ErrNoRows) || (err == nil && (d.Status == "ready" || d.Status == "failed")) {
			if err = s.Storage.RemoveStage(id); err != nil {
				return err
			}
		} else if err != nil {
			return err
		}
	}
	entries, err := os.ReadDir(filepath.Join(s.Storage.Root, "work"))
	if err != nil {
		return err
	}
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			return err
		}
		if time.Since(info.ModTime()) > 15*time.Minute {
			if err = os.RemoveAll(filepath.Join(s.Storage.Root, "work", e.Name())); err != nil {
				return err
			}
		}
	}
	return nil
}
