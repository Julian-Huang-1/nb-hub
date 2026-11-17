-- name: LockSiteOwner :one
SELECT id FROM app_user WHERE id = $1 FOR UPDATE;

-- name: CountOwnerSites :one
SELECT count(*) FROM site WHERE owner_id = $1 AND deleted_at IS NULL;

-- name: OwnerStorage :one
SELECT coalesce(sum(d.storage_bytes), 0)::bigint FROM deployment d JOIN site s ON s.id=d.site_id WHERE s.owner_id=$1;

-- name: CreateSite :one
INSERT INTO site(id,owner_id,name,visibility,routing_mode,short_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (short_id) DO NOTHING RETURNING *;

-- name: GetOwnedSite :one
SELECT * FROM site WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL;

-- name: LockOwnedSite :one
SELECT * FROM site WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL FOR UPDATE;

-- name: GetContentSite :one
SELECT * FROM site WHERE id=$1 AND deleted_at IS NULL;

-- name: ListSites :many
SELECT * FROM site WHERE owner_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3;

-- name: UpdateSite :one
UPDATE site SET name=$3, visibility=$4, routing_mode=$5, revision=revision+1 WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL AND revision=$6 RETURNING *;

-- name: DeleteSite :execrows
UPDATE site SET deleted_at=now(),current_deployment_id=NULL,revision=revision+1 WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL;

-- name: PublishSite :one
UPDATE site SET current_deployment_id=sqlc.narg(deployment_id)::uuid,revision=revision+1 WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL AND revision=$3 RETURNING *;

-- name: CreateDeployment :one
INSERT INTO deployment(id,site_id,status,format,entrypoint,message,idempotency_key,storage_bytes,short_id) VALUES($1,$2,'uploading',$3,$4,$5,$6,$7,$8) ON CONFLICT (short_id) DO NOTHING RETURNING *;

-- name: GetDeployment :one
SELECT * FROM deployment WHERE site_id=$1 AND id=$2;

-- name: GetPreviewDeployment :one
SELECT * FROM deployment WHERE id=$1 AND status='ready';

-- name: GetIdempotentDeployment :one
SELECT * FROM deployment WHERE site_id=$1 AND idempotency_key=$2;

-- name: ListDeployments :many
SELECT * FROM deployment WHERE site_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3;

-- name: QueueDeployment :one
UPDATE deployment SET status='queued',content_hash=$2,updated_at=now() WHERE id=$1 AND status='uploading' RETURNING *;

-- name: CreateDeploymentJob :exec
INSERT INTO deployment_job(deployment_id) VALUES($1);

-- name: ClaimDeploymentJob :one
WITH candidate AS (
 SELECT j.deployment_id FROM deployment_job j JOIN deployment d ON d.id=j.deployment_id
 JOIN site s ON s.id=d.site_id
 WHERE NOT j.done AND j.lease_until <= now() AND s.deleted_at IS NULL
 ORDER BY j.lease_until FOR UPDATE OF j SKIP LOCKED LIMIT 1
)
UPDATE deployment_job j SET attempts=j.attempts+1,lease_until=now()+interval '5 minutes',lease_id=$1
FROM candidate c WHERE j.deployment_id=c.deployment_id RETURNING j.*;

-- name: StartDeployment :one
UPDATE deployment SET status='processing',updated_at=now() WHERE id=$1 AND status IN ('queued','processing') RETURNING *;

-- name: FinishDeployment :exec
UPDATE deployment SET status=$2,error_code=$3,storage_bytes=$4,updated_at=now() WHERE id=$1;

-- name: FinishDeploymentJob :execrows
UPDATE deployment_job SET done=true WHERE deployment_id=$1 AND lease_id=$2 AND NOT done;

-- name: FailUpload :exec
UPDATE deployment SET status='failed',error_code='upload_failed',storage_bytes=0,updated_at=now() WHERE id=$1 AND status='uploading';

-- name: ExpireUploads :many
UPDATE deployment SET status='failed',error_code='upload_expired',storage_bytes=0,updated_at=now() WHERE status='uploading' AND updated_at < now()-interval '15 minutes' RETURNING id;

-- name: DeletedSiteArtifacts :many
SELECT d.* FROM deployment d JOIN site s ON s.id=d.site_id WHERE s.deleted_at IS NOT NULL AND s.deleted_at < now()-interval '10 minutes' AND d.storage_bytes>0;

-- name: CreateAccessTicket :exec
INSERT INTO site_access_ticket(token_hash,site_id,session_id,hostname,expires_at) VALUES($1,$2,$3,$4,$5);

-- name: ConsumeAccessTicket :one
DELETE FROM site_access_ticket t USING auth_session a,site s
WHERE t.token_hash=$1 AND t.hostname=$2 AND t.expires_at>now() AND a.id=t.session_id AND a.revoked_at IS NULL AND a.expires_at>now()
AND s.id=t.site_id AND s.owner_id=a.user_id AND s.deleted_at IS NULL
RETURNING t.*;

-- name: CreateContentSession :exec
INSERT INTO site_content_session(token_hash,site_id,session_id,hostname,expires_at) VALUES($1,$2,$3,$4,$5);

-- name: AuthorizeContent :one
SELECT c.site_id FROM site_content_session c JOIN auth_session a ON a.id=c.session_id JOIN site s ON s.id=c.site_id
WHERE c.token_hash=$1 AND c.hostname=$2 AND c.site_id=$3 AND c.expires_at>now() AND a.revoked_at IS NULL AND a.expires_at>now() AND a.user_id=s.owner_id AND s.deleted_at IS NULL;

-- name: PruneContentAuth :exec
DELETE FROM site_access_ticket WHERE expires_at<=now();

-- name: PruneContentSessions :exec
DELETE FROM site_content_session WHERE expires_at<=now();

-- name: LockStorageQuota :exec
SELECT pg_advisory_xact_lock(62486301);

-- name: TotalSiteStorage :one
SELECT coalesce(sum(storage_bytes),0)::bigint FROM deployment;

-- name: GetAnyDeployment :one
SELECT * FROM deployment WHERE id=$1;

-- name: CountOwnerDeployments :one
SELECT count(*) FROM deployment d JOIN site s ON s.id=d.site_id WHERE s.owner_id=$1;

-- name: GetContentSiteByShortID :one
SELECT * FROM site WHERE short_id=$1 AND deleted_at IS NULL;

-- name: GetPreviewDeploymentByShortID :one
SELECT * FROM deployment WHERE short_id=$1 AND status='ready';
