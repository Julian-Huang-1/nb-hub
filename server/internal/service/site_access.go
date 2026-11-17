package service

import (
	"context"
	"net/url"
	"time"

	"github.com/Julian-Huang-1/nb-hub/server/internal/auth"
	db "github.com/Julian-Huang-1/nb-hub/server/pkg/db/generated"
	"github.com/google/uuid"
)

type AccessTicket struct {
	Ticket      string    `json:"ticket"`
	ExchangeURL string    `json:"exchange_url"`
	ExpiresAt   time.Time `json:"expires_at"`
}

func (s *Sites) AccessTicket(ctx context.Context, identity Identity, site uuid.UUID, preview *uuid.UUID) (AccessTicket, error) {
	if identity.Kind != "session" {
		return AccessTicket{}, ErrSessionRequired
	}
	owned, err := s.Get(ctx, identity.User.ID, site)
	if err != nil {
		return AccessTicket{}, err
	}
	targetURL := owned.URL
	if preview != nil {
		d, err := s.GetDeployment(ctx, identity.User.ID, site, *preview)
		if err != nil {
			return AccessTicket{}, err
		}
		targetURL = d.PreviewURL
		if d.Status != "ready" {
			return AccessTicket{}, ErrNotReady
		}
	}
	token, err := auth.RandomToken("sat_")
	if err != nil {
		return AccessTicket{}, err
	}
	target, err := url.Parse(targetURL)
	if err != nil {
		return AccessTicket{}, err
	}
	host := target.Host
	expires := time.Now().Add(time.Minute)
	err = s.Queries.CreateAccessTicket(ctx, db.CreateAccessTicketParams{TokenHash: auth.HashToken(token), SiteID: site, SessionID: identity.SessionID, Hostname: host, ExpiresAt: expires})
	return AccessTicket{token, s.Config.Scheme + "://" + host + "/.nbhub/access", expires}, err
}
func (s *Sites) ExchangeTicket(ctx context.Context, host, token string) (string, time.Time, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return "", time.Time{}, err
	}
	defer tx.Rollback(ctx)
	q := s.Queries.WithTx(tx)
	ticket, err := q.ConsumeAccessTicket(ctx, db.ConsumeAccessTicketParams{TokenHash: auth.HashToken(token), Hostname: host})
	if err != nil {
		return "", time.Time{}, siteError(err)
	}
	cookie, err := auth.RandomToken("scs_")
	if err != nil {
		return "", time.Time{}, err
	}
	expires := time.Now().Add(time.Hour)
	err = q.CreateContentSession(ctx, db.CreateContentSessionParams{TokenHash: auth.HashToken(cookie), SiteID: ticket.SiteID, SessionID: ticket.SessionID, Hostname: host, ExpiresAt: expires})
	if err != nil {
		return "", time.Time{}, err
	}
	return cookie, expires, tx.Commit(ctx)
}
func (s *Sites) AuthorizeContent(ctx context.Context, site uuid.UUID, host, token string) error {
	_, err := s.Queries.AuthorizeContent(ctx, db.AuthorizeContentParams{TokenHash: auth.HashToken(token), Hostname: host, SiteID: site})
	return siteError(err)
}
