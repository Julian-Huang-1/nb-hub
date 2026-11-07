package api

import (
	"log/slog"
	"net/http"

	"github.com/Julian-Huang-1/nb-hub/server/internal/handler"
	"github.com/Julian-Huang-1/nb-hub/server/internal/middleware"
	"github.com/Julian-Huang-1/nb-hub/server/internal/service"
	"github.com/go-chi/chi/v5"
)

func RouterWithSites(log *slog.Logger, authentication *service.Auth, sites *service.Sites) http.Handler {
	base := Router(log, authentication)
	if sites == nil || authentication == nil {
		return base
	}
	r := base.(*chi.Mux)
	h := &handler.Sites{Service: sites, Log: log}
	r.Route("/api/v1/sites", func(r chi.Router) {
		r.Use(middleware.Authenticate(authentication))
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Cache-Control", "no-store")
				next.ServeHTTP(w, r)
			})
		})
		r.Post("/", h.Create)
		r.Get("/", h.List)
		r.Route("/{site_id}", func(r chi.Router) {
			r.Get("/", h.Get)
			r.Patch("/", h.Update)
			r.Delete("/", h.Delete)
			r.Put("/publication", h.Publish)
			r.Delete("/publication", h.Unpublish)
			r.Post("/access-tickets", h.AccessTicket)
			r.Post("/deployments", h.Upload)
			r.Get("/deployments", h.ListDeployments)
			r.Get("/deployments/{deployment_id}", h.GetDeployment)
		})
	})
	return (&handler.SiteContent{Sites: sites}).Wrap(r)
}
