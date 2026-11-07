package handler

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Julian-Huang-1/nb-hub/server/internal/middleware"
	"github.com/Julian-Huang-1/nb-hub/server/internal/service"
	"github.com/Julian-Huang-1/nb-hub/server/internal/storage"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type Sites struct {
	Service *service.Sites
	Log     *slog.Logger
}

func (h *Sites) fail(w http.ResponseWriter, err error) {
	status, code, message := 500, "internal_error", "The request could not be completed"
	switch {
	case errors.Is(err, service.ErrNotFound):
		status, code, message = 404, "not_found", err.Error()
	case errors.Is(err, storage.ErrUploadTooLarge):
		status, code, message = 413, "upload_too_large", err.Error()
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
		status, code, message = 408, "request_timeout", "The request did not finish in time"
	case errors.Is(err, service.ErrInvalidInput), errors.Is(err, storage.ErrInvalidArchive), errors.Is(err, io.ErrUnexpectedEOF):
		status, code, message = 400, "invalid_input", "Invalid upload or request values"
	case errors.Is(err, service.ErrPublicationConflict):
		status, code, message = 409, "publication_conflict", "The site changed; fetch its revision before retrying"
	case errors.Is(err, service.ErrIdempotencyConflict):
		status, code, message = 409, "idempotency_conflict", "The key is in progress or was used with different content"
	case errors.Is(err, service.ErrNotReady):
		status, code, message = 409, "deployment_not_ready", err.Error()
	case errors.Is(err, service.ErrQuota):
		status, code, message = 413, "quota_exceeded", err.Error()
	case errors.Is(err, service.ErrSessionRequired):
		status, code, message = 403, "session_required", err.Error()
	default:
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			status, code, message = 413, "upload_too_large", "Upload exceeds the request limit"
		} else {
			h.Log.Error("site request failed", "error", err)
		}
	}
	JSON(w, status, map[string]string{"code": code, "error": message})
}
func siteID(r *http.Request) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, "site_id"))
	if err != nil {
		return uuid.Nil, service.ErrNotFound
	}
	return id, nil
}
func deploymentID(r *http.Request) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, "deployment_id"))
	if err != nil {
		return uuid.Nil, service.ErrNotFound
	}
	return id, nil
}
func page(r *http.Request) (int32, int32, error) {
	limit, offset := int64(50), int64(0)
	var err error
	if v := r.URL.Query().Get("limit"); v != "" {
		limit, err = strconv.ParseInt(v, 10, 32)
		if err != nil {
			return 0, 0, service.ErrInvalidInput
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		offset, err = strconv.ParseInt(v, 10, 32)
		if err != nil {
			return 0, 0, service.ErrInvalidInput
		}
	}
	if limit < 1 || limit > 100 || offset < 0 {
		return 0, 0, service.ErrInvalidInput
	}
	return int32(limit), int32(offset), nil
}
func (h *Sites) Create(w http.ResponseWriter, r *http.Request) {
	body := struct {
		Name        string `json:"name"`
		Visibility  string `json:"visibility"`
		RoutingMode string `json:"routing_mode"`
	}{Visibility: "private", RoutingMode: "static"}
	if !decode(w, r, &body) {
		return
	}
	v, err := h.Service.Create(r.Context(), middleware.Identity(r.Context()).User.ID, body.Name, body.Visibility, body.RoutingMode)
	if err != nil {
		h.fail(w, err)
		return
	}
	JSON(w, 201, v)
}
func (h *Sites) List(w http.ResponseWriter, r *http.Request) {
	limit, offset, err := page(r)
	if err != nil {
		h.fail(w, err)
		return
	}
	v, err := h.Service.List(r.Context(), middleware.Identity(r.Context()).User.ID, limit, offset)
	if err != nil {
		h.fail(w, err)
		return
	}
	JSON(w, 200, map[string]any{"items": v, "limit": limit, "offset": offset})
}
func (h *Sites) Get(w http.ResponseWriter, r *http.Request) {
	id, err := siteID(r)
	if err != nil {
		h.fail(w, err)
		return
	}
	v, err := h.Service.Get(r.Context(), middleware.Identity(r.Context()).User.ID, id)
	if err != nil {
		h.fail(w, err)
		return
	}
	JSON(w, 200, v)
}
func (h *Sites) Update(w http.ResponseWriter, r *http.Request) {
	id, err := siteID(r)
	if err != nil {
		h.fail(w, err)
		return
	}
	var body struct {
		Name             *string `json:"name"`
		Visibility       *string `json:"visibility"`
		RoutingMode      *string `json:"routing_mode"`
		ExpectedRevision *int64  `json:"expected_revision"`
	}
	if !decode(w, r, &body) {
		return
	}
	if body.ExpectedRevision == nil {
		h.fail(w, service.ErrInvalidInput)
		return
	}
	owner := middleware.Identity(r.Context()).User.ID
	old, err := h.Service.Get(r.Context(), owner, id)
	if err != nil {
		h.fail(w, err)
		return
	}
	if body.Name != nil {
		old.Name = *body.Name
	}
	if body.Visibility != nil {
		old.Visibility = *body.Visibility
	}
	if body.RoutingMode != nil {
		old.RoutingMode = *body.RoutingMode
	}
	v, err := h.Service.Update(r.Context(), owner, id, old.Name, old.Visibility, old.RoutingMode, *body.ExpectedRevision)
	if err != nil {
		h.fail(w, err)
		return
	}
	JSON(w, 200, v)
}
func (h *Sites) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := siteID(r)
	if err == nil {
		err = h.Service.Delete(r.Context(), middleware.Identity(r.Context()).User.ID, id)
	}
	if err != nil {
		h.fail(w, err)
		return
	}
	JSON(w, 204, nil)
}
func (h *Sites) Publish(w http.ResponseWriter, r *http.Request)   { h.publication(w, r, false) }
func (h *Sites) Unpublish(w http.ResponseWriter, r *http.Request) { h.publication(w, r, true) }
func (h *Sites) publication(w http.ResponseWriter, r *http.Request, unpublish bool) {
	id, err := siteID(r)
	if err != nil {
		h.fail(w, err)
		return
	}
	var body struct {
		DeploymentID     *uuid.UUID `json:"deployment_id"`
		ExpectedRevision *int64     `json:"expected_revision"`
	}
	if !decode(w, r, &body) {
		return
	}
	if body.ExpectedRevision == nil || (!unpublish && body.DeploymentID == nil) || (unpublish && body.DeploymentID != nil) {
		h.fail(w, service.ErrInvalidInput)
		return
	}
	v, err := h.Service.Publish(r.Context(), middleware.Identity(r.Context()).User.ID, id, body.DeploymentID, *body.ExpectedRevision)
	if err != nil {
		h.fail(w, err)
		return
	}
	JSON(w, 200, v)
}
func (h *Sites) ListDeployments(w http.ResponseWriter, r *http.Request) {
	id, err := siteID(r)
	if err != nil {
		h.fail(w, err)
		return
	}
	limit, offset, err := page(r)
	if err != nil {
		h.fail(w, err)
		return
	}
	v, err := h.Service.ListDeployments(r.Context(), middleware.Identity(r.Context()).User.ID, id, limit, offset)
	if err != nil {
		h.fail(w, err)
		return
	}
	JSON(w, 200, map[string]any{"items": v, "limit": limit, "offset": offset})
}
func (h *Sites) GetDeployment(w http.ResponseWriter, r *http.Request) {
	id, err := siteID(r)
	if err != nil {
		h.fail(w, err)
		return
	}
	dep, err := deploymentID(r)
	if err != nil {
		h.fail(w, err)
		return
	}
	v, err := h.Service.GetDeployment(r.Context(), middleware.Identity(r.Context()).User.ID, id, dep)
	if err != nil {
		h.fail(w, err)
		return
	}
	JSON(w, 200, v)
}
func (h *Sites) AccessTicket(w http.ResponseWriter, r *http.Request) {
	id, err := siteID(r)
	if err != nil {
		h.fail(w, err)
		return
	}
	var body struct {
		DeploymentID *uuid.UUID `json:"deployment_id"`
	}
	if !decode(w, r, &body) {
		return
	}
	v, err := h.Service.AccessTicket(r.Context(), middleware.Identity(r.Context()), id, body.DeploymentID)
	if err != nil {
		h.fail(w, err)
		return
	}
	JSON(w, 201, v)
}

// fileLast verifies multipart framing before Upload can queue a deployment.
type fileLast struct {
	part    *multipart.Part
	reader  *multipart.Reader
	checked bool
}

func (f *fileLast) Read(p []byte) (int, error) {
	n, err := f.part.Read(p)
	if err == io.EOF && !f.checked {
		f.checked = true
		_, nextErr := f.reader.NextPart()
		if nextErr != io.EOF {
			return n, service.ErrInvalidInput
		}
	}
	return n, err
}
func (h *Sites) Upload(w http.ResponseWriter, r *http.Request) {
	id, err := siteID(r)
	if err != nil {
		h.fail(w, err)
		return
	}
	// Reject ownership before accepting an upload body.
	owner := middleware.Identity(r.Context()).User.ID
	if _, err = h.Service.Get(r.Context(), owner, id); err != nil {
		h.fail(w, err)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Minute)
	defer cancel()
	r = r.WithContext(ctx)
	r.Body = http.MaxBytesReader(w, r.Body, storage.MaxUpload+(64<<10))
	reader, err := r.MultipartReader()
	if err != nil {
		h.fail(w, service.ErrInvalidInput)
		return
	}
	entry, message := "index.html", ""
	seen := map[string]bool{}
	for {
		part, err := reader.NextPart()
		if err != nil {
			h.fail(w, service.ErrInvalidInput)
			return
		}
		name := part.FormName()
		if seen[name] {
			h.fail(w, service.ErrInvalidInput)
			return
		}
		seen[name] = true
		if name == "file" {
			ext := strings.ToLower(filepath.Ext(part.FileName()))
			format := ""
			switch ext {
			case ".html", ".htm":
				format = "html"
			case ".zip":
				format = "zip"
			default:
				h.fail(w, service.ErrInvalidInput)
				return
			}
			v, err := h.Service.Upload(ctx, owner, id, format, entry, message, r.Header.Get("Idempotency-Key"), &fileLast{part: part, reader: reader})
			if err != nil {
				h.fail(w, err)
				return
			}
			w.Header().Set("Location", v.StatusURL)
			JSON(w, 202, v)
			return
		}
		if part.FileName() != "" || (name != "entrypoint" && name != "message") {
			h.fail(w, service.ErrInvalidInput)
			return
		}
		b, err := io.ReadAll(io.LimitReader(part, 4097))
		if err != nil || len(b) > 4096 {
			h.fail(w, service.ErrInvalidInput)
			return
		}
		if name == "entrypoint" {
			entry = string(b)
		} else {
			message = string(b)
		}
	}
}

// AllowContentTLS is called by the internal-only Caddy certificate permission endpoint.
func (h *Sites) AllowContentTLS(w http.ResponseWriter, r *http.Request) {
	if _, _, err := h.Service.ResolveContentHost(r.Context(), r.URL.Query().Get("domain")); err != nil {
		if errors.Is(err, service.ErrNotFound) {
			http.Error(w, "domain not allowed", http.StatusForbidden)
		} else {
			h.fail(w, err)
		}
		return
	}
	w.WriteHeader(http.StatusOK)
}
