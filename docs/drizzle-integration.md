# Drizzle ORM integration

This repository now has a **server-only** Drizzle/PostgreSQL client in `src/lib/db/client.ts` and a TypeScript table model in `drizzle/schema.ts`.

## Setup

1. Provision a **new empty** PostgreSQL 16+ database.
2. Set `DATABASE_URL` in an ignored local `.env` or deployment secrets (see `.env.example`). Do not use `NEXT_PUBLIC_`.
3. Apply SQL migrations 0001–0005 in order using `psql` as documented in `database/README.md`.
4. Use `db` only in server-side modules. Importing the client without `DATABASE_URL` will throw.

## Important migration boundary

The SQL baseline is the **authoritative applied schema** for now. The Drizzle TypeScript schema maps its tables but does not yet fully express the SQL-only composite foreign keys and `NULLS NOT DISTINCT` uniqueness. Do **not** run `drizzle-kit push`, `generate`, or `migrate` on an existing database: doing so could create duplicate objects or drift. The legacy `drizzle/migrations` folder is from Supabase and must not be applied.

Before enabling Drizzle migrations, reconcile the SQL baseline with generated snapshots, include the composite constraints in Drizzle declarations or custom SQL, and test migration history on a fresh PostgreSQL database.

## Security

Authentication and sessions are described in [authentication.md](authentication.md). Subtype enforcement is provided by SQL migration 0002. Authorized resident directory reads, management and invitation onboarding are implemented with separate server scope checks; see [resident authorization](resident-authorization.md), [management](management-workspace.md) and [onboarding](invitation-onboarding.md). Ownership and household detail previews require dedicated APIs.

## Lockfile

The PR includes a temporary GitHub Actions workflow that refreshes `pnpm-lock.yaml` on this repository's own `feat/drizzle-postgres-integration` branch without running install scripts. Confirm that the lockfile commit appears and the standard CI passes before merging. The temporary workflow should be removed in a follow-up PR after merge.
