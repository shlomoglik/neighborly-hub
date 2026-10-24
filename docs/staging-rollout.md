# Staging environment rollout

## Scope and status

This is a rollout plan, not an implementation of Staging isolation. Merging this document does not configure a database, change credentials, enable Preview migrations or make Staging operational.

### Repository evidence

Verified against the code in this PR:

| Area          | Current behavior                                                                                                                                                        | Consequence for Staging                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Runtime       | `src/lib/db/client.ts` uses `DATABASE_URL` and unqualified `pgTable` declarations from `drizzle/schema.ts`. Better Auth uses this database through its Drizzle adapter. | There is no explicit application-schema selection or environment identity guard.                 |
| Migrations    | `scripts/db/migrations.mjs` forces `search_path = public, pg_catalog`, checks whether `public` is populated and stores history in `neighborly_migrations.history`.      | Pointing the current runner at a shared database cannot initialize an isolated `staging` schema. |
| Deployment    | `scripts/vercel-build.mjs` runs migrations after a successful build only when `VERCEL_ENV=production`.                                                                  | Preview builds do not migrate; build success does not prove database connectivity or isolation.  |
| CI            | `.github/workflows/nextjs.yml` runs on PRs targeting `main` and pushes to `main`.                                                                                       | PRs targeting `staging` and pushes to `staging` do not currently receive these checks.           |
| Local tooling | `pnpm dev:staging` loads a private environment file and forces the auth origin to localhost.                                                                            | This command does not provision a hosted Staging environment.                                    |

### Previously reported hosted configuration

The original investigation on 2026-10-23 reported a `staging` branch deployed as Vercel Preview, branch-scoped `BETTER_AUTH_URL` / `BETTER_AUTH_SECRET`, and Production-only database variables. These are historical observations, not current verification of provider settings. Recheck branch mapping, deployment protection and effective environment scopes before activation; never include secret values in review evidence.

**Do not copy Production database credentials to Preview.** Keep arbitrary PR previews without live database credentials. Scope Staging secrets to the exact `staging` branch, including any inherited project/integration variables that could otherwise supply a Production connection.

## Isolation design and implementation gates

The proposed shared-database option requires a dedicated application schema `staging`, a separate migration-history schema and distinct runtime/migration login roles. It is not supported by the current code. Use a separate database/project if the following boundaries cannot be established without changing Production access.

1. **Prove effective database privileges first.** Both Staging roles must lack Production ownership, elevated privileges and role membership that permits access or `SET ROLE` into Production roles. Check inherited and `PUBLIC` grants, schema access, tables, sequences and callable functions, including `SECURITY DEFINER` functions. A role-specific revoke cannot cancel access received through `PUBLIC`. Do not revoke shared Production grants as part of this rollout; use a separate database/project if necessary. The runtime role gets only required data/function access within Staging, with no DDL or migration-history access; the migration role owns only Staging objects. Verify default grants for newly migrated objects as well as existing ones.
2. **Make the migration runner schema-aware.** Select the application and history schemas from a fixed allowlist, quote SQL identifiers safely and fail closed on invalid combinations. Update the populated-schema/baseline checks and history references together. Review migration SQL, function bodies, triggers and catalog lookups for schema assumptions. Preserve immutable migration checksums, transaction ownership and rollback/idempotency guarantees. Never baseline Staging from Production history or modify Production history. Initialize an empty Staging schema by replaying all authoritative migrations.
3. **Route every runtime query to Staging.** Cover Drizzle queries/relations and the Better Auth adapter, not just raw SQL. Validate behavior across fresh/reused connections and the actual hosting pool mode. A URL or role `search_path` alone is not a security boundary. Runtime and migration connections must resolve to the same approved database/environment and distinct least-privilege roles; reject mismatches before writes or DDL. No Production fallback is allowed when Staging configuration is absent.
4. **Add disposable PostgreSQL integration coverage.** Create synthetic Production and Staging schemas and distinct roles. Exercise runtime CRUD, real auth/session queries and the migration runner using their actual roles. Assert that both Staging roles cannot read/change Production data, alter Production objects, change Production history or access privileged functions. Check unchanged Production sentinel data/history, separate Staging history, repeat migrations, rollback/retry and privileges on newly created objects. Existing database tests do not prove these boundaries.
5. **Extend the deployment gate and CI explicitly.** Enable Staging migrations only for the approved `staging` Preview branch after the previous gates pass. Missing configuration must block that deployment. Keep Production behavior unchanged and other previews migration-free. Test branch/environment combinations and build-before-migrate ordering. Add CI triggers/check requirements for Staging before using it as a release gate. The migration connection must use direct or session-mode access, as required by the current runner.

Schema isolation still shares database resources, backups and administrative access with Production. It provides no independent recovery or performance boundary.

## Hosted activation after implementation

1. Configure encrypted branch-scoped `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `BETTER_AUTH_URL` and a distinct `BETTER_AUTH_SECRET`. Check the effective environment for the branch and for an unrelated PR preview without disclosing values. See [deployment migrations](deployment-migrations.md) for the existing gate and connection requirements.
2. Use one stable HTTPS Staging origin. Register its exact `/api/auth/callback/google` URL and configure both Google credentials if Google sign-in is enabled. Auth trusts the configured origin, not arbitrary preview URLs. Deployment protection must allow the intended testers and callback journey.
3. Email signup/recovery is optional: configure both `RESEND_API_KEY` and `AUTH_EMAIL_FROM` only with an authorized sending domain and test recipients. Without mail configuration, new email registration and recovery are unavailable; existing verified users can set/use passwords. See [authentication](authentication.md) for the precise behavior and account-linking restrictions.
4. Deploy the reviewed commit to `staging`, initialize synthetic data only, sign in and bootstrap the intended test administrator using [local environment instructions](local-environments.md#administrator-bootstrap). Signing in alone grants no management role. Verify the target identity and isolation before running remote bootstrap.
5. Complete a real login/logout and project-setup journey, verify data after reload and test unauthorized access. If mail is enabled, also verify delivery, verification, recovery and token reuse rejection. Redeploy to check migration idempotency. Record commit/deployment identifiers, check results and sanitized evidence of unchanged Production state. Do not copy resident data or Production accounts/sessions.

## Promotion and recovery

Keep the existing feature-PR-to-`main` workflow for this documentation change. Once Staging activation and its CI checks are implemented, validate a reviewed release commit on `staging` before deploying that same commit/content to Production. A different merge commit or changed release content requires revalidation. A different staging-first branching policy needs its own workflow/check configuration; this document does not introduce one.

Do not promote a Preview artifact as a substitute for the Production build: the existing Production migration gate must execute against the Production database. Require backward-compatible migrations while the previous deployment still serves traffic. Application rollback does not roll back database changes; see [deployment migrations](deployment-migrations.md#history-locking-and-failures). If a Staging gate fails, stop activation and remove/disable Staging access as needed; do not repair it with Production credentials.

## Acceptance evidence

This documentation PR can be reviewed independently. **Staging may be declared operational only when all implementation gates, hosted configuration checks and the live smoke journey above have passed.** Attach sanitized results to the implementation PR; unresolved checks remain blockers, not completed checklist items.
