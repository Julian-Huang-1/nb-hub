-- name: GetUserByEmail :one
SELECT * FROM app_user WHERE email = $1;
-- name: GetUser :one
SELECT * FROM app_user WHERE id = $1;
-- name: CreateUser :one
INSERT INTO app_user (email, name) VALUES ($1, $2)
ON CONFLICT (email) DO UPDATE SET email = excluded.email RETURNING *;
-- name: LinkGoogle :one
UPDATE app_user SET google_sub = $2 WHERE id = $1 AND (google_sub IS NULL OR google_sub = $2) RETURNING *;
-- name: SaveCode :one
INSERT INTO login_code (email, code_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')
ON CONFLICT (email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = now()
WHERE login_code.sent_at < now() - interval '60 seconds' RETURNING *;
-- name: LockCode :one
SELECT * FROM login_code WHERE email = $1 FOR UPDATE;
-- name: FailCode :exec
UPDATE login_code SET attempts = attempts + 1 WHERE email = $1;
-- name: DeleteCode :exec
DELETE FROM login_code WHERE email = $1;
-- name: DeleteUnsentCode :exec
DELETE FROM login_code WHERE email = $1 AND code_hash = $2;
-- name: CreateSession :one
INSERT INTO auth_session (id, user_id, user_agent, expires_at) VALUES ($1, $2, $3, $4) RETURNING *;
-- name: GetSession :one
SELECT * FROM auth_session WHERE id = $1 AND revoked_at IS NULL AND expires_at > now();
-- name: RenewSession :one
UPDATE auth_session SET expires_at = $2 WHERE id = $1 AND revoked_at IS NULL AND expires_at > now() RETURNING *;
-- name: RevokeSession :exec
UPDATE auth_session SET revoked_at = now() WHERE id = $1 AND user_id = $2;
-- name: ListSessions :many
SELECT id, user_agent, created_at, expires_at FROM auth_session
WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY created_at DESC;
-- name: CreatePAT :one
INSERT INTO personal_access_token (user_id, name, token_prefix, token_hash, expires_at) VALUES ($1, $2, $3, $4, $5)
RETURNING id, name, token_prefix, created_at, expires_at;
-- name: GetPAT :one
SELECT * FROM personal_access_token WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now();
-- name: TouchPAT :exec
UPDATE personal_access_token SET last_used_at = now() WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < now() - interval '1 minute');
-- name: ListPATs :many
SELECT id, name, token_prefix, created_at, expires_at, last_used_at FROM personal_access_token
WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY created_at DESC;
-- name: RevokePAT :exec
UPDATE personal_access_token SET revoked_at = now() WHERE id = $1 AND user_id = $2;
