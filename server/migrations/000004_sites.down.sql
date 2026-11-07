BEGIN;
DROP TABLE site_content_session;
DROP TABLE site_access_ticket;
DROP TABLE deployment_job;
ALTER TABLE site DROP CONSTRAINT site_current_deployment;
DROP TABLE deployment;
DROP TABLE site;
COMMIT;
