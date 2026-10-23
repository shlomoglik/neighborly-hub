# Staging environment rollout (review checklist)

## Existing state (verified 2026-10-23)

- Git branch `staging` exists and Vercel deploys it as Preview.
- Branch-scoped `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` exist.
- `DATABASE_URL` and `MIGRATION_DATABASE_URL` are currently Production-only.
- The application uses unqualified Drizzle `pgTable` declarations.
- The migration runner explicitly sets `search_path = public, pg_catalog` and stores history in `neighborly_migrations.history`.
- The Vercel build runs migrations for Production only.

**Do not copy Production database credentials to Preview.** A successful Vercel build does not prove database connectivity.

## Required implementation before enabling writes

1. Create a dedicated `staging` PostgreSQL schema and two dedicated login roles for runtime and migrations, without privileges on Production application tables. Prefer a separate Supabase project if schema-level privilege isolation cannot be proven end-to-end.
2. Update the migration runner to select the schema explicitly and keep migration history independent of Production. Validate the schema identifier against a fixed allowlist; never interpolate untrusted SQL identifiers. Review existing migration SQL for explicit `public.` references and cross-schema dependencies.
3. Update runtime database access and Drizzle SQL generation so all application and Better Auth queries resolve to Staging only. Verify connection pool reset/search-path behavior; an unqualified `pgTable` plus URL `search_path` is not by itself a security boundary.
4. Add integration tests using two isolated schemas and distinct database roles. Test both runtime and migration paths, including a negative test proving the Staging role cannot SELECT/INSERT/UPDATE/DELETE Production data.
5. Enable a branch-scoped Staging migration gate after the isolation tests pass. Keep the existing Production gate unchanged.
6. Configure branch-scoped encrypted `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, and provider credentials in Vercel. Never commit or copy connection secrets into this repository.
7. Register the exact Staging callback URL with Google OAuth and configure email sender/Resend only after confirming domain authorization.
8. Deploy the `staging` branch, verify login, a complete project setup, database isolation, and repeat deployment/idempotent migrations.

## Promotion flow

- Feature PRs merge into `staging` for QA.
- Promote approved changes from `staging` to `main` through reviewed PRs.
- Production remains connected to `main` and its existing credentials.
- Protect both branches and require CI checks.

## Review gate

Do not mark Staging ready until all database isolation tests and a live smoke test pass. No database DDL or credential changes are included in this documentation-only PR.
