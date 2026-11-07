CREATE INDEX CONCURRENTLY personal_access_token_owner ON personal_access_token (user_id, created_at DESC);
