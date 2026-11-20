-- Run once as the database administrator, before enabling Staging connections.
-- No Production objects or grants are changed. Set strong, distinct passwords
-- through the secret manager separately; never commit passwords to this file.
BEGIN;
CREATE ROLE neighborly_staging_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE neighborly_staging_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT neighborly_staging_migrator TO CURRENT_USER WITH SET TRUE;
CREATE SCHEMA staging AUTHORIZATION neighborly_staging_migrator;
CREATE SCHEMA neighborly_staging_migrations AUTHORIZATION neighborly_staging_migrator;
REVOKE ALL ON SCHEMA staging, neighborly_staging_migrations FROM PUBLIC;
GRANT USAGE ON SCHEMA staging TO neighborly_staging_app;
ALTER ROLE neighborly_staging_app SET search_path = staging, pg_catalog;
ALTER ROLE neighborly_staging_migrator SET search_path = staging, pg_catalog;
ALTER DEFAULT PRIVILEGES FOR ROLE neighborly_staging_migrator IN SCHEMA staging
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO neighborly_staging_app;
ALTER DEFAULT PRIVILEGES FOR ROLE neighborly_staging_migrator IN SCHEMA staging
  GRANT USAGE, SELECT ON SEQUENCES TO neighborly_staging_app;
-- Global default revocation is required for functions; a schema-level revoke
-- cannot override the global default EXECUTE grant to PUBLIC.
ALTER DEFAULT PRIVILEGES FOR ROLE neighborly_staging_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE neighborly_staging_migrator IN SCHEMA staging
  GRANT EXECUTE ON FUNCTIONS TO neighborly_staging_app;
COMMIT;
