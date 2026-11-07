CREATE INDEX CONCURRENTLY auth_session_owner ON auth_session (user_id, created_at DESC);
