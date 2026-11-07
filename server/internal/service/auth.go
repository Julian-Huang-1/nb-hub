package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/mail"
	"strings"
	"time"

	"github.com/Julian-Huang-1/nb-hub/server/internal/auth"
	db "github.com/Julian-Huang-1/nb-hub/server/pkg/db/generated"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrCredentials         = errors.New("invalid or expired credentials")
	ErrSignupDisabled      = errors.New("registration is not allowed for this email")
	ErrRateLimited         = errors.New("please wait before trying again")
	ErrProviderUnavailable = errors.New("login provider is not configured or unavailable")
	ErrInvalidInput        = errors.New("invalid input")
	ErrSessionRequired     = errors.New("an interactive login session is required")
)

type User struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

func userResponse(u db.AppUser) User { return User{u.ID, u.Email, u.Name, u.CreatedAt} }

type Identity struct {
	User      User
	SessionID uuid.UUID
	ExpiresAt time.Time
	Kind      string
}
type Login struct {
	User      User      `json:"user"`
	ExpiresAt time.Time `json:"expires_at"`
	Token     string    `json:"token,omitempty"`
	SessionID uuid.UUID `json:"-"`
}
type CodeSender interface {
	Send(context.Context, string, string) error
}
type Auth struct {
	Pool    *pgxpool.Pool
	Queries *db.Queries
	Config  auth.Config
	Sender  CodeSender
}

func NewAuth(pool *pgxpool.Pool, cfg auth.Config, sender CodeSender) *Auth {
	return &Auth{Pool: pool, Queries: db.New(pool), Config: cfg, Sender: sender}
}
func NormalizeEmail(raw string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(raw))
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email || len(email) > 254 {
		return "", ErrInvalidInput
	}
	return email, nil
}
func (s *Auth) codeHash(email, code string) []byte {
	return auth.Digest(s.Config.Secret, "login-code:"+email+":"+code)
}
func (s *Auth) SendCode(ctx context.Context, raw string) error {
	email, err := NormalizeEmail(raw)
	if err != nil {
		return err
	}
	if !s.Config.EmailEnabled() {
		return ErrProviderUnavailable
	}
	code := s.Config.DevCode
	if code == "" || s.Config.Production {
		n, err := rand.Int(rand.Reader, big.NewInt(1000000))
		if err != nil {
			return err
		}
		code = fmt.Sprintf("%06d", n.Int64())
	}
	hash := s.codeHash(email, code)
	_, err = s.Queries.SaveCode(ctx, db.SaveCodeParams{Email: email, CodeHash: hash})
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrRateLimited
	}
	if err != nil {
		return err
	}
	if !s.Config.Production && s.Config.DevCode != "" {
		return nil
	}
	if s.Sender == nil {
		return ErrProviderUnavailable
	}
	if err := s.Sender.Send(ctx, email, code); err != nil {
		_ = s.Queries.DeleteUnsentCode(ctx, db.DeleteUnsentCodeParams{Email: email, CodeHash: hash})
		return fmt.Errorf("%w: mail delivery failed", ErrProviderUnavailable)
	}
	return nil
}
func (s *Auth) findUser(ctx context.Context, q *db.Queries, email, name string) (db.AppUser, error) {
	user, err := q.GetUserByEmail(ctx, email)
	if err == nil {
		return user, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return user, err
	}
	allowed := len(s.Config.AllowedEmails) == 0 && len(s.Config.AllowedDomains) == 0
	for _, e := range s.Config.AllowedEmails {
		allowed = allowed || email == e
	}
	domain := strings.SplitN(email, "@", 2)[1]
	for _, d := range s.Config.AllowedDomains {
		allowed = allowed || domain == d
	}
	if !s.Config.AllowSignup || !allowed {
		return user, ErrSignupDisabled
	}
	if name == "" {
		name = strings.SplitN(email, "@", 2)[0]
	}
	name = string([]rune(name)[:min(80, len([]rune(name)))])
	return q.CreateUser(ctx, db.CreateUserParams{Email: email, Name: name})
}
func (s *Auth) newSession(ctx context.Context, q *db.Queries, user db.AppUser, userAgent string) (Login, error) {
	expires := time.Now().Add(s.Config.TTL).Truncate(time.Second)
	sid := uuid.New()
	agent := []rune(userAgent)
	if len(agent) > 200 {
		agent = agent[:200]
	}
	token, err := auth.Sign(s.Config.Secret, user.ID, sid, expires)
	if err != nil {
		return Login{}, err
	}
	if _, err := q.CreateSession(ctx, db.CreateSessionParams{ID: sid, UserID: user.ID, UserAgent: string(agent), ExpiresAt: expires}); err != nil {
		return Login{}, err
	}
	return Login{User: userResponse(user), ExpiresAt: expires, Token: token, SessionID: sid}, nil
}
func (s *Auth) VerifyCode(ctx context.Context, raw, code, userAgent string) (Login, error) {
	email, err := NormalizeEmail(raw)
	if err != nil || !auth.ValidCode(code) {
		return Login{}, ErrCredentials
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return Login{}, err
	}
	defer tx.Rollback(ctx)
	q := s.Queries.WithTx(tx)
	stored, err := q.LockCode(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		return Login{}, ErrCredentials
	}
	if err != nil {
		return Login{}, err
	}
	if !stored.ExpiresAt.After(time.Now()) || stored.Attempts >= 5 {
		return Login{}, ErrCredentials
	}
	if !hmac.Equal(stored.CodeHash, s.codeHash(email, code)) {
		if err := q.FailCode(ctx, email); err != nil {
			return Login{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return Login{}, err
		}
		return Login{}, ErrCredentials
	}
	user, err := s.findUser(ctx, q, email, "")
	if err != nil {
		return Login{}, err
	}
	login, err := s.newSession(ctx, q, user, userAgent)
	if err != nil {
		return Login{}, err
	}
	if err := q.DeleteCode(ctx, email); err != nil {
		return Login{}, err
	}
	return login, tx.Commit(ctx)
}
func (s *Auth) GoogleLogin(ctx context.Context, email, name, subject, userAgent string) (Login, error) {
	email, err := NormalizeEmail(email)
	if err != nil || subject == "" {
		return Login{}, ErrCredentials
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return Login{}, err
	}
	defer tx.Rollback(ctx)
	q := s.Queries.WithTx(tx)
	user, err := s.findUser(ctx, q, email, name)
	if err != nil {
		return Login{}, err
	}
	user, err = q.LinkGoogle(ctx, db.LinkGoogleParams{ID: user.ID, GoogleSub: pgtype.Text{String: subject, Valid: true}})
	if errors.Is(err, pgx.ErrNoRows) {
		return Login{}, ErrCredentials
	}
	if err != nil {
		return Login{}, err
	}
	login, err := s.newSession(ctx, q, user, userAgent)
	if err != nil {
		return Login{}, err
	}
	return login, tx.Commit(ctx)
}
func (s *Auth) Authenticate(ctx context.Context, raw string) (Identity, error) {
	if strings.HasPrefix(raw, "nbp_") {
		token, err := s.Queries.GetPAT(ctx, auth.HashToken(raw))
		if errors.Is(err, pgx.ErrNoRows) {
			return Identity{}, ErrCredentials
		}
		if err != nil {
			return Identity{}, err
		}
		user, err := s.Queries.GetUser(ctx, token.UserID)
		if err != nil {
			return Identity{}, err
		}
		if err := s.Queries.TouchPAT(ctx, token.ID); err != nil {
			return Identity{}, err
		}
		return Identity{User: userResponse(user), ExpiresAt: token.ExpiresAt, Kind: "pat"}, nil
	}
	claims, err := auth.Parse(s.Config.Secret, raw)
	if err != nil {
		return Identity{}, ErrCredentials
	}
	session, err := s.Queries.GetSession(ctx, claims.SessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Identity{}, ErrCredentials
	}
	if err != nil {
		return Identity{}, err
	}
	if session.UserID.String() != claims.Subject {
		return Identity{}, ErrCredentials
	}
	user, err := s.Queries.GetUser(ctx, session.UserID)
	if err != nil {
		return Identity{}, err
	}
	return Identity{User: userResponse(user), SessionID: session.ID, ExpiresAt: claims.ExpiresAt.Time, Kind: "session"}, nil
}
func (s *Auth) Renew(ctx context.Context, identity Identity) (Login, bool, error) {
	if identity.Kind != "session" {
		return Login{}, false, ErrSessionRequired
	}
	result := Login{User: identity.User, SessionID: identity.SessionID, ExpiresAt: identity.ExpiresAt}
	if time.Until(identity.ExpiresAt) >= s.Config.TTL/2 {
		return result, false, nil
	}
	expires := time.Now().Add(s.Config.TTL).Truncate(time.Second)
	session, err := s.Queries.RenewSession(ctx, db.RenewSessionParams{ID: identity.SessionID, ExpiresAt: expires})
	if errors.Is(err, pgx.ErrNoRows) {
		return Login{}, false, ErrCredentials
	}
	if err != nil {
		return Login{}, false, err
	}
	result.ExpiresAt = session.ExpiresAt
	result.Token, err = auth.Sign(s.Config.Secret, identity.User.ID, identity.SessionID, session.ExpiresAt)
	return result, true, err
}
func (s *Auth) RevokeSession(ctx context.Context, identity Identity, id uuid.UUID) error {
	if identity.Kind != "session" {
		return ErrSessionRequired
	}
	return s.Queries.RevokeSession(ctx, db.RevokeSessionParams{ID: id, UserID: identity.User.ID})
}
func (s *Auth) ListSessions(ctx context.Context, identity Identity) ([]db.ListSessionsRow, error) {
	if identity.Kind != "session" {
		return nil, ErrSessionRequired
	}
	return s.Queries.ListSessions(ctx, identity.User.ID)
}
func (s *Auth) CreatePAT(ctx context.Context, identity Identity, name string, days int) (db.CreatePATRow, string, error) {
	if identity.Kind != "session" {
		return db.CreatePATRow{}, "", ErrSessionRequired
	}
	name = strings.TrimSpace(name)
	if len([]rune(name)) < 1 || len([]rune(name)) > 80 || days < 1 || days > 365 {
		return db.CreatePATRow{}, "", ErrInvalidInput
	}
	token, err := auth.RandomToken("nbp_")
	if err != nil {
		return db.CreatePATRow{}, "", err
	}
	row, err := s.Queries.CreatePAT(ctx, db.CreatePATParams{UserID: identity.User.ID, Name: name, TokenPrefix: token[:12], TokenHash: auth.HashToken(token), ExpiresAt: time.Now().Add(time.Duration(days) * 24 * time.Hour)})
	return row, token, err
}
func (s *Auth) ListPATs(ctx context.Context, identity Identity) ([]db.ListPATsRow, error) {
	if identity.Kind != "session" {
		return nil, ErrSessionRequired
	}
	return s.Queries.ListPATs(ctx, identity.User.ID)
}
func (s *Auth) RevokePAT(ctx context.Context, identity Identity, id uuid.UUID) error {
	if identity.Kind != "session" {
		return ErrSessionRequired
	}
	return s.Queries.RevokePAT(ctx, db.RevokePATParams{ID: id, UserID: identity.User.ID})
}
