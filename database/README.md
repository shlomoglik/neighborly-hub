# Independent PostgreSQL schema baseline

This PR introduces a **standalone PostgreSQL schema and integration smoke test** for the model approved in `docs/database-foundation.md`.

## Run locally

With PostgreSQL 16 running and an empty database:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0001_initial.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0002_party_subtype_integrity.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0003_auth_sessions.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/tests/auth-integrity.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/tests/smoke.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/tests/party-integrity.sql
```

The smoke test rolls back its fixture data. The migration is intended for a **new empty database** and is not idempotent. Do not run it on an existing Supabase database or alongside `drizzle/migrations/0000_migration.sql`.

## Boundaries and follow-ups

- The current migration is plain PostgreSQL SQL, **not yet Drizzle-generated**. The legacy Drizzle files are retained untouched and must not be executed.
- Drizzle and the PostgreSQL driver are installed. SQL migrations remain authoritative until Drizzle snapshots and migration metadata are reconciled.
- The second SQL migration enforces that every `party` has exactly one subtype matching its `kind`, at transaction commit. Create a party and its subtype in the **same transaction**. Existing orphaned/mismatched rows must be cleaned before applying this migration to a populated database.
- The sum of co-ownership shares is not yet enforced across rows.
- Migration 0003 adds the [authentication/session foundation](../docs/authentication.md) without changing user UUIDs. Server-side resident authorization and privacy-filtered queries remain unimplemented; do not connect real resident data yet.
- The independent schema deliberately does not depend on Supabase `auth.users` or Supabase roles.
