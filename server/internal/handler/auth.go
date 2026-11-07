package handler

import (
	"encoding/json"
	"errors"
	"github.com/Julian-Huang-1/nb-hub/server/internal/auth"
	"github.com/Julian-Huang-1/nb-hub/server/internal/middleware"
	"github.com/Julian-Huang-1/nb-hub/server/internal/service"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"io"
	"log/slog"
	"net/http"
)

type Auth struct {
	Service *service.Auth
	Log     *slog.Logger
	Google  *auth.GoogleProvider
}

func JSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if status != 204 {
		json.NewEncoder(w).Encode(value)
	}
}
func (h *Auth) fail(w http.ResponseWriter, err error) {
	status, code, message := 500, "internal_error", "The request could not be completed"
	switch {
	case errors.Is(err, service.ErrCredentials):
		status, code, message = 401, "invalid_credentials", "Invalid or expired credentials"
	case errors.Is(err, service.ErrSignupDisabled):
		status, code, message = 403, "signup_not_allowed", err.Error()
	case errors.Is(err, service.ErrRateLimited):
		status, code, message = 429, "rate_limited", "Please wait 60 seconds before requesting another code"
		w.Header().Set("Retry-After", "60")
	case errors.Is(err, service.ErrProviderUnavailable):
		status, code, message = 503, "provider_unavailable", "Login provider is not configured or unavailable"
	case errors.Is(err, service.ErrInvalidInput):
		status, code, message = 400, "invalid_input", "Check the supplied values"
	case errors.Is(err, service.ErrSessionRequired):
		status, code, message = 403, "session_required", "An interactive login session is required"
	default:
		h.Log.Error("auth request failed", "error", err)
	}
	JSON(w, status, map[string]string{"code": code, "error": message})
}
func decode(w http.ResponseWriter, r *http.Request, value any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 8192)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		JSON(w, 400, map[string]string{"code": "invalid_input", "error": "Invalid request body"})
		return false
	}
	if decoder.Decode(new(any)) != io.EOF {
		JSON(w, 400, map[string]string{"code": "invalid_input", "error": "Request must contain one JSON value"})
		return false
	}
	return true
}
func (h *Auth) Config(w http.ResponseWriter, r *http.Request) {
	JSON(w, 200, map[string]any{"email_login": h.Service.Config.EmailEnabled(), "google_login": h.Service.Config.GoogleEnabled(), "signup_enabled": h.Service.Config.AllowSignup})
}
func (h *Auth) SendCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if !decode(w, r, &body) {
		return
	}
	if err := h.Service.SendCode(r.Context(), body.Email); err != nil {
		h.fail(w, err)
		return
	}
	JSON(w, 200, map[string]string{"message": "A verification code has been sent"})
}
func (h *Auth) login(w http.ResponseWriter, r *http.Request, result service.Login) {
	if r.Header.Get("X-Auth-Mode") != "bearer" {
		auth.SetCookies(w, result.Token, result.SessionID, result.ExpiresAt, h.Service.Config)
		result.Token = ""
	}
	JSON(w, 200, result)
}
func (h *Auth) VerifyCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if !decode(w, r, &body) {
		return
	}
	result, err := h.Service.VerifyCode(r.Context(), body.Email, body.Code, r.UserAgent())
	if err != nil {
		h.fail(w, err)
		return
	}
	h.login(w, r, result)
}
func (h *Auth) Me(w http.ResponseWriter, r *http.Request) {
	identity := middleware.Identity(r.Context())
	JSON(w, 200, map[string]any{"user": identity.User, "expires_at": identity.ExpiresAt, "kind": identity.Kind, "session_id": identity.SessionID})
}
func (h *Auth) Refresh(w http.ResponseWriter, r *http.Request) {
	result, renewed, err := h.Service.Renew(r.Context(), middleware.Identity(r.Context()))
	if err != nil {
		h.fail(w, err)
		return
	}
	_, cookie := auth.Extract(r, h.Service.Config.Production)
	if cookie {
		if renewed {
			auth.SetCookies(w, result.Token, result.SessionID, result.ExpiresAt, h.Service.Config)
		}
		result.Token = ""
	}
	JSON(w, 200, map[string]any{"token": result.Token, "expires_at": result.ExpiresAt, "renewed": renewed, "check_again_in_seconds": max(5, int(h.Service.Config.TTL.Seconds()/10))})
}
func (h *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	identity := middleware.Identity(r.Context())
	if err := h.Service.RevokeSession(r.Context(), identity, identity.SessionID); err != nil {
		h.fail(w, err)
		return
	}
	auth.ClearCookies(w, h.Service.Config.Production)
	JSON(w, 204, nil)
}
func (h *Auth) Sessions(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Service.ListSessions(r.Context(), middleware.Identity(r.Context()))
	if err != nil {
		h.fail(w, err)
		return
	}
	JSON(w, 200, rows)
}
func (h *Auth) RevokeSession(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		h.fail(w, service.ErrInvalidInput)
		return
	}
	identity := middleware.Identity(r.Context())
	if err := h.Service.RevokeSession(r.Context(), identity, id); err != nil {
		h.fail(w, err)
		return
	}
	if identity.SessionID == id {
		auth.ClearCookies(w, h.Service.Config.Production)
	}
	JSON(w, 204, nil)
}
func (h *Auth) PATs(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Service.ListPATs(r.Context(), middleware.Identity(r.Context()))
	if err != nil {
		h.fail(w, err)
		return
	}
	JSON(w, 200, rows)
}
func (h *Auth) CreatePAT(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name          string `json:"name"`
		ExpiresInDays int    `json:"expires_in_days"`
	}
	if !decode(w, r, &body) {
		return
	}
	row, token, err := h.Service.CreatePAT(r.Context(), middleware.Identity(r.Context()), body.Name, body.ExpiresInDays)
	if err != nil {
		h.fail(w, err)
		return
	}
	JSON(w, 201, map[string]any{"token": token, "personal_access_token": row})
}
func (h *Auth) RevokePAT(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		h.fail(w, service.ErrInvalidInput)
		return
	}
	if err := h.Service.RevokePAT(r.Context(), middleware.Identity(r.Context()), id); err != nil {
		h.fail(w, err)
		return
	}
	JSON(w, 204, nil)
}
