# Independent PostgreSQL foundation

## Current blockers

The existing `drizzle/migrations/0000_migration.sql` is a **legacy Supabase migration**, not a safe bootstrap for an independent PostgreSQL instance. It references `auth.users`, Supabase roles (`authenticated`, `service_role`), and Supabase-specific authorization policies/functions. The active `drizzle/schema.ts` now maps the independent SQL schema; the legacy migration snapshot must not be used. **Do not run the legacy migration against a new database.**

The existing `drizzle.config.ts` uses `LOVABLE_DB_MIGRATION_URL`; it is not an approved independent database configuration.

## Proposed schema (application-owned tables)

- `users`: id (UUID), email (unique), display_name, created_at. Better Auth now uses `app_users` directly, with separate session/account/verification tables; see [authentication.md](authentication.md). Password login is disabled.
- `projects`: id, name, city, directory_visibility (`community` / `building`), created_at.
- `buildings`: id, project_id (FK), name; unique (project_id, name). Do not store `units_per_floor` as a structural assumption.
- `floors`: id, building_id (FK), number (integer, supporting basement/ground floors); unique (building_id, number). A floor may have zero apartments.
- `apartments`: id, floor_id (FK), number; each floor can have a different number of apartments. Apartment numbers must be unique **within the building**, not merely within a floor. Enforce this with a database-level constraint or a transaction-safe design (e.g. store `building_id` on apartments with a composite FK `(floor_id, building_id)` referencing floors and `unique (building_id, number)`).
- `households`: id, apartment_id (FK), display_name, approval_status (`pending` / `approved` / `rejected`), created_by (FK users), created_at. Enforce **at most one active household per apartment** using a database uniqueness constraint or a partial unique index on active records. Empty apartments are allowed.
- `parties`: id, kind (`person` / `organization`), created_at. Represents a legal owner/holder regardless of whether it is a natural person or legal entity; the type must match exactly one subtype record.
- `people`: party_id (PK/FK parties), full_name, birth_date, is_child. A person exists independently of residence or ownership; a person may own one apartment and live in another.
- `organizations`: party_id (PK/FK parties), name, organization_kind (e.g. company / developer / municipality / nonprofit / other), optional registration_number, optional registration_country. Do not require a registration number for all entities; enforce uniqueness for non-null identifiers within the relevant jurisdiction/type.
- `household_members`: id, household_id (FK), person_id (FK people.party_id), relation, is_contact_person (boolean), contact_priority (nullable integer), contact_priority; unique (household_id, person_id). Multiple members, including both partners, may be contact persons with equal priority. Contact priority does **not** grant edit or administration rights.
- `apartment_ownerships`: id, apartment_id (FK), owner_party_id (FK parties), optional ownership_share; unique (apartment_id, owner_party_id). A party may own many apartments, and an apartment may have multiple owners (individuals and/or organizations). Ownership is independent of household membership. If ownership_share is stored, validate each value and enforce total shares at the application/transaction boundary (or with a suitable database trigger) rather than assuming a simple row CHECK can validate totals.
- `contact_methods`: id, party_id (FK parties), kind (`phone` / `email`), value, label, visibility (`project` / `building` / `managers`). Each person or organization may have multiple phone numbers and emails; child phone numbers default to `managers` visibility.
- `organization_contacts`: id, organization_party_id (FK organizations.party_id), person_party_id (FK people.party_id), role_label, is_primary_contact (boolean); unique (organization_party_id, person_party_id). Contact representatives do not inherit apartment ownership or management permissions.
- `staff_assignments`: id, user_id (FK), project_id (FK), building_id (nullable FK), role (`project_manager` / `building_manager`); constrain building assignment to the same project.
- `global_roles`: user_id (FK), role (`admin`).
- `invitations`: scoped resident/staff invitation, optional verified recipient restriction, hash-only token, issuer, expiry/revocation/consumption timestamps.
- `join_requests`: account-owned pending/approved/rejected request, optional resident payload, reviewer and review timestamp. Pending requests grant no access; see [invitation onboarding](invitation-onboarding.md).

Use PostgreSQL CHECK constraints for valid floor and apartment numbers, and indexes for foreign keys and directory lookups. The number of floors and apartments per floor is derived from rows, not fixed columns on `buildings`. A household can have multiple members and multiple primary contact persons. A person can have multiple phone numbers/emails. A phone number belonging to a child should default to `managers` visibility.

## Apartment and household cardinality

An apartment is the smallest residential unit represented by the application. It can have **zero or one active household**, never multiple concurrent active households. If a physical unit is split into separate rentals, register separate numbered apartments instead of introducing sub-apartments. Historic/inactive household records may be retained for audit purposes without violating the active-household uniqueness constraint.

Ownership is modeled independently of residency: multiple parties (people or organizations) may jointly own an apartment, and none need be members of its current household. A single developer, company, or municipality may own multiple apartments across buildings/projects. A person may be a resident, an owner, or both. Organizations are not household members. Contact persons are chosen per household and are **not** restricted to a single `is_primary` flag; two partners can both be contact persons. Access-control roles are managed separately.

## Building creation wizard

The creation UI can accept a default number of floors and apartments per floor for convenience, then allow overrides for individual floors (including floors with no apartments). These inputs are **generation parameters**, not permanent database constraints. Generate explicit floor and apartment rows in one transaction, preserving building-wide unique apartment numbering. Floor numbering must support ground and basement levels; avoid assuming all floors start at 1.

## Migration and security sequence

1. **Do not apply** the existing Supabase SQL migration. Preserve it as historical reference until a new independent migration is generated and reviewed.
2. Add `drizzle-orm`, `drizzle-kit`, and a PostgreSQL driver with a reproducible lockfile update. Replace the Lovable URL with a server-only `DATABASE_URL`, and supply a sanitized `.env.example`.
3. Define the schema in `drizzle/schema.ts` and generate a fresh initial migration **from that schema**. Never mix the legacy empty Drizzle snapshot with a new migration journal.
4. Add an ephemeral PostgreSQL integration test that runs migrations from scratch, validates foreign keys, uniqueness, and approval defaults.
5. Better Auth maps its UUID user ID directly to `app_users.id`; configure Google and apply migration 0003 before enabling sign-in.
6. Enforce role checks, approval status, building/project scope, and per-contact visibility **in server-side queries** before replacing mock data or deploying. Never rely on hidden UI controls as authorization.
7. Add audited administrator workflows for membership approval and privacy-sensitive updates.

## Deployment boundary

The directory now uses authenticated, privacy-filtered resident reads; see [resident authorization](resident-authorization.md). The management workspace uses authenticated structural reads; see [management workspace](management-workspace.md). Invitation joining and scoped approval now persist; see [invitation onboarding](invitation-onboarding.md). Household detail previews remain synthetic.

Migration 0006 adds household-scoped private child-profile provenance (`is_managed_child`), per-household creation keys and household-bound adult invitations. The composite invitation/household apartment FK prevents invitation reassignment to another household. See [family membership](family-membership.md) for privacy and mutation rules.

Migration 0007 adds nullable `buildings.address` (maximum 500 characters). Addresses are independent of project city and building name. Floor counts are derived from explicit apartment rows, never persisted as an independent count. See [flexible building layouts](building-layouts.md).
