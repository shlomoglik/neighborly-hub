# Independent PostgreSQL schema baseline

This PR introduces a **standalone PostgreSQL schema and integration smoke test** for the model approved in `docs/database-foundation.md`.

## Deployment automation

Production Vercel builds now apply pending migrations with checksummed history and a transaction lock before publication. Existing manually initialized databases require explicit one-time adoption. See [deployment migrations](../docs/deployment-migrations.md) for activation, failure handling and rollback constraints. Do not mix manual SQL application with the runner after adoption.

## Run locally

With PostgreSQL 16 running and an empty database:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0001_initial.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0002_party_subtype_integrity.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0003_auth_sessions.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0004_resident_identity.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0005_invitations.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0006_household_members.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0007_building_addresses.sql
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
- Migration 0003 adds the [authentication/session foundation](../docs/authentication.md) without changing user UUIDs. Resident authorization, management and invitation onboarding use independently scoped server queries; see the linked architecture documents.
- The independent schema deliberately does not depend on Supabase `auth.users` or Supabase roles.

Apply `migrations/0004_resident_identity.sql` after 0003 to enable explicit user/person links. See [resident authorization](../docs/resident-authorization.md) for provisioning and directory access rules.

Migration 0005 enables [invitation onboarding](../docs/invitation-onboarding.md) after 0004. Apply all seven in order before enabling the current application.

Migration `0006_household_members.sql` adds private child-profile provenance/retry keys and household-bound adult invitations. Apply it after 0005, then run `database/tests/family-integrity.sql`. Existing rows default to unmanaged profiles; identity/membership data is preserved.

Migration `0007_building_addresses.sql` adds the optional building address without altering existing names, IDs or relationships. Apply it before deploying the flexible layout editor.
