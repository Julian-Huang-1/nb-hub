package handler

import (
	"github.com/Julian-Huang-1/nb-hub/server/internal/auth"
	"github.com/Julian-Huang-1/nb-hub/server/internal/service"
	"net/http"
	"time"
)

func (h *Auth) GoogleStart(w http.ResponseWriter, r *http.Request) {
	if !h.Service.Config.GoogleEnabled() {
		h.fail(w, service.ErrProviderUnavailable)
		return
	}
	location, cookie, err := h.Google.Start()
	if err != nil {
		h.fail(w, err)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: auth.GoogleCookie, Value: cookie, Path: "/api/auth/google", HttpOnly: true, Secure: h.Service.Config.Production, SameSite: http.SameSiteLaxMode, MaxAge: 600})
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, location, http.StatusFound)
}
func (h *Auth) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(auth.GoogleCookie)
	http.SetCookie(w, &http.Cookie{Name: auth.GoogleCookie, Path: "/api/auth/google", HttpOnly: true, Secure: h.Service.Config.Production, SameSite: http.SameSiteLaxMode, MaxAge: -1, Expires: time.Unix(1, 0)})
	redirect := func() {
		http.Redirect(w, r, h.Service.Config.FrontendOrigin+"/?auth_error=google_login_failed", http.StatusSeeOther)
	}
	if !h.Service.Config.GoogleEnabled() || err != nil {
		redirect()
		return
	}
	user, err := h.Google.Finish(r.Context(), cookie.Value, r.URL.Query().Get("state"), r.URL.Query().Get("code"))
	if err != nil {
		redirect()
		return
	}
	login, err := h.Service.GoogleLogin(r.Context(), user.Email, user.Name, user.Subject, r.UserAgent())
	if err != nil {
		redirect()
		return
	}
	auth.SetCookies(w, login.Token, login.SessionID, login.ExpiresAt, h.Service.Config)
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, h.Service.Config.FrontendOrigin+"/", http.StatusSeeOther)
}
