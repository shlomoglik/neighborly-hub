# Independent PostgreSQL foundation

## Current blockers

The existing `drizzle/migrations/0000_migration.sql` is a **legacy Supabase migration**, not a safe bootstrap for an independent PostgreSQL instance. It references `auth.users`, Supabase roles (`authenticated`, `service_role`), and Supabase-specific authorization policies/functions. The current `drizzle/schema.ts` is empty and its migration snapshot has no tables. **Do not run the legacy migration against a new database.**

The existing `drizzle.config.ts` uses `LOVABLE_DB_MIGRATION_URL`; it is not an approved independent database configuration.

## Proposed schema (application-owned tables)

- `users`: id (UUID), email (unique), display_name, created_at. Authentication credentials and sessions must be managed by the chosen auth provider; avoid storing plaintext passwords.
- `projects`: id, name, city, directory_visibility (`community` / `building`), created_at.
- `buildings`: id, project_id (FK), name, floors, units_per_floor; unique (project_id, name).
- `apartments`: id, building_id (FK), floor, number; unique (building_id, number).
- `households`: id, apartment_id (FK), display_name, ownership, approval_status (`pending` / `approved` / `rejected`), created_by (FK users), created_at.
- `contacts`: id, household_id (FK), full_name, relation, is_primary, is_child, birth_date, sort_order.
- `contact_phones`: id, contact_id (FK), number, label, visibility (`project` / `building` / `managers`).
- `contact_emails`: id, contact_id (FK), email, label, visibility.
- `staff_assignments`: id, user_id (FK), project_id (FK), building_id (nullable FK), role (`project_manager` / `building_manager`); constrain building assignment to the same project.
- `global_roles`: user_id (FK), role (`admin`).

Use PostgreSQL CHECK constraints for floors and unit counts, and indexes for foreign keys and directory lookups. A household can have multiple contacts; contacts can have multiple phone numbers/emails. A phone number belonging to a child should default to `managers` visibility.

## Migration and security sequence

1. **Do not apply** the existing Supabase SQL migration. Preserve it as historical reference until a new independent migration is generated and reviewed.
2. Add `drizzle-orm`, `drizzle-kit`, and a PostgreSQL driver with a reproducible lockfile update. Replace the Lovable URL with a server-only `DATABASE_URL`, and supply a sanitized `.env.example`.
3. Define the schema in `drizzle/schema.ts` and generate a fresh initial migration **from that schema**. Never mix the legacy empty Drizzle snapshot with a new migration journal.
4. Add an ephemeral PostgreSQL integration test that runs migrations from scratch, validates foreign keys, uniqueness, and approval defaults.
5. Select an authentication provider and define how its user IDs map to `users` before enabling registration.
6. Enforce role checks, approval status, building/project scope, and per-contact visibility **in server-side queries** before replacing mock data or deploying. Never rely on hidden UI controls as authorization.
7. Add audited administrator workflows for membership approval and privacy-sensitive updates.

## Deployment boundary

The current Next.js UI remains mock-only. This document does not add a live database connection, authentication, or permissions. No real resident data should be entered until server-side authorization and privacy tests are implemented.
