BEGIN;
CREATE TABLE site (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES app_user(id),
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
    visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private')),
    routing_mode text NOT NULL DEFAULT 'static' CHECK (routing_mode IN ('static','spa')),
    current_deployment_id uuid,
    revision bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
CREATE INDEX site_owner ON site(owner_id, created_at DESC);
CREATE TABLE deployment (
    id uuid PRIMARY KEY,
    site_id uuid NOT NULL REFERENCES site(id),
    status text NOT NULL CHECK (status IN ('uploading','queued','processing','ready','failed')),
    format text NOT NULL CHECK (format IN ('html','zip')),
    entrypoint text NOT NULL,
    message text NOT NULL DEFAULT '',
    content_hash text NOT NULL DEFAULT '',
    idempotency_key text,
    storage_bytes bigint NOT NULL CHECK (storage_bytes >= 0),
    error_code text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(site_id, id),
    UNIQUE(site_id, idempotency_key)
);
ALTER TABLE site ADD CONSTRAINT site_current_deployment FOREIGN KEY (id, current_deployment_id) REFERENCES deployment(site_id, id);
CREATE INDEX deployment_site ON deployment(site_id, created_at DESC);
CREATE TABLE deployment_job (
    deployment_id uuid PRIMARY KEY REFERENCES deployment(id) ON DELETE CASCADE,
    attempts integer NOT NULL DEFAULT 0,
    lease_until timestamptz NOT NULL DEFAULT now(),
    lease_id uuid,
    done boolean NOT NULL DEFAULT false
);
CREATE INDEX deployment_job_pending ON deployment_job(lease_until) WHERE NOT done;
CREATE TABLE site_access_ticket (
    token_hash bytea PRIMARY KEY,
    site_id uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    session_id uuid NOT NULL REFERENCES auth_session(id) ON DELETE CASCADE,
    hostname text NOT NULL,
    expires_at timestamptz NOT NULL
);
CREATE TABLE site_content_session (
    token_hash bytea PRIMARY KEY,
    site_id uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    session_id uuid NOT NULL REFERENCES auth_session(id) ON DELETE CASCADE,
    hostname text NOT NULL,
    expires_at timestamptz NOT NULL
);
COMMIT;
