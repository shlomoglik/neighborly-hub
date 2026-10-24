# Isolated Staging environment

## Implemented behavior

Staging runs on the exact Vercel Preview branch `staging`, using the same PostgreSQL database as Production with a private `staging` application schema. Production continues to use `public` and `neighborly_migrations.history`. Staging history is separate: `neighborly_staging_migrations.history`.

`DATABASE_SCHEMA` accepts only `public` (the default) or `staging`. Hosted Staging requires both Preview environment and the exact `staging` branch; another hosted branch cannot use the Staging schema. Missing schema configuration on the Staging branch fails closed. Local `pnpm dev:staging` requires the same explicit schema and dedicated runtime role.

Drizzle qualifies all Staging tables, including the Better Auth adapter's tables. The client disables prepared statements for compatibility with transaction pooling. Trigger functions are pinned to their own schema after migration, so a reused connection's search path cannot redirect deferred constraint checks. Admin bootstrap uses the selected schema too.

## Roles and provisioning

Apply [staging-roles.sql](../database/operations/staging-roles.sql) once as the database administrator. It creates only Staging roles/schemas/default privileges and does not change existing Production objects or grants. It deliberately fails if those names already exist; inspect an existing installation rather than overwriting it. Set distinct strong passwords through the secret manager, never in committed SQL.

| Login role                    | Purpose                                                | Grants                                                                                                               |
| ----------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `neighborly_staging_app`      | Application, auth and explicit Staging admin bootstrap | Schema usage and table CRUD, sequence usage/select, invoker function execution within Staging; no DDL/history access |
| `neighborly_staging_migrator` | Deployment migrations                                  | Owns only Staging application/history schemas and objects; no Production data or DDL access                          |

Both roles must have no elevated flags or membership in other roles. Before any Staging DDL, the migration runner checks effective privileges, including `PUBLIC`/inherited grants, database/schema creation, access to tables/sequences outside Staging and executable security-definer functions outside Staging. It also verifies schema ownership and runtime schema restrictions. A failure blocks deployment without changing Production grants. Use a separate database/project if isolation cannot be established without changing Production access.

Keep the schemas outside Supabase's exposed Data API schemas. Do not grant `anon`, `authenticated`, `service_role` or arbitrary application users access to Staging. Application authorization remains enforced by the server; database login roles separate environments, not individual residents.

## Vercel configuration

Configure the following on **Preview, Git branch `staging` only**. Check inherited integration variables too; unrelated PR previews must not receive database credentials. Never copy Production database credentials.

| Variable                                   | Value/requirement                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `DATABASE_SCHEMA`                          | `staging`                                                                                                     |
| `DATABASE_URL`                             | Dedicated `neighborly_staging_app` credentials                                                                |
| `MIGRATION_DATABASE_URL`                   | Dedicated `neighborly_staging_migrator` credentials; direct/session mode, never port 6543 transaction pooling |
| `BETTER_AUTH_URL`                          | Exact stable HTTPS Staging origin                                                                             |
| `BETTER_AUTH_SECRET`                       | Independent strong secret                                                                                     |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional pair, with the exact Staging `/api/auth/callback/google` callback registered                         |
| `RESEND_API_KEY`, `AUTH_EMAIL_FROM`        | Optional pair, authorized sender and test recipients                                                          |

Runtime and migration URLs must use the same hostname/database path (ports may differ). Use the session-pooler endpoint for both when direct IPv6 is unavailable. Supavisor usernames may append `.<project-ref>` to each role. Only `sslmode` URL options are accepted for Staging. The runner verifies the actual migration login and both database roles' effective permissions; URL labels alone do not establish isolation.

The committed build gate validates Staging configuration, builds the application, then runs migrations before publication. It retains the existing Production gate and leaves unrelated Preview/Development deployments migration-free. Staging replays all authoritative migrations on an empty schema, never baselines from Production history, and retains immutable checksums, atomic rollback, advisory locking and idempotency. Existing migration SQL is unchanged.

CI runs on PRs targeting `main`/`staging` and pushes to both. The database job includes disposable role/schema isolation tests. Branch protection/check requirements are provider settings and must be enabled separately before making Staging a mandatory release gate.

## Local use and activation checks

Copy `.env.staging.example` to a private `.env.staging.local` and populate the runtime credentials/schema. `pnpm dev:staging` uses localhost for the auth origin; deployed and local callbacks must each be registered. `pnpm admin:grant:staging --email ...` requires `ALLOW_REMOTE_ADMIN_BOOTSTRAP=true` and exactly one existing verified user. Signing in does not grant a management role. See [local environments](local-environments.md).

Before declaring the hosted environment operational:

1. Verify role/schema ownership and effective grants, exact branch secret scopes and deployment protection for testers.
2. Deploy the reviewed release content to `staging`; confirm migration completion and a second idempotent deployment.
3. Complete real login/logout and an authorized project-setup journey using synthetic data; reload to confirm persistence and check unauthorized access. Confirm Production data and migration history remain unchanged.
4. If Google is enabled, verify the real callback. If mail is enabled, verify delivery, registration, verification, recovery and rejection of reused tokens. Without mail configuration, signup/recovery are unavailable; verified existing users can set/use passwords. See [authentication](authentication.md).
5. Record sanitized commit/deployment identifiers and actual results in the PR. Repository/CI success does not itself prove hosted login or configuration.

## Promotion and recovery

Keep feature PRs targeting `main` unless the project adopts a separate staging-first policy. To validate a release before Production, deploy that exact reviewed commit/content to `staging`; changes to release content require revalidation. Publishing the implementation on `main` alone does not update the `staging` branch.

Production still requires its own build and migration gate; promoting a Preview artifact does not substitute for it. Use backward-compatible migrations while the previous application version serves traffic. Application rollback does not roll back database changes. See [deployment migrations](deployment-migrations.md#history-locking-and-failures).

Schema isolation shares compute, backups and administrative access with Production. It does not provide independent recovery/performance boundaries. If Staging verification fails, stop activation; do not substitute Production credentials or relax the role checks.
