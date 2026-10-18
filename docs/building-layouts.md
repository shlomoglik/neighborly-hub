# Flexible building layouts and addresses

The setup wizard accepts a uniform apartment count and optional `floorUnits` overrides
(one count per floor, from 0 through 200). Zero allows a lobby without apartments.
Floors still start at 0 and apartment numbering is continuous per building. Capacity
validation uses the actual overridden counts. Copying a draft layout to the other
buildings preserves their names and addresses; individual overrides can then be edited.
Legacy uniform setup payloads remain valid.

Existing buildings have an **Edit apartment layout** action. Select one building for
an exception or multiple buildings for a shared change. Set a common count across all
selected existing floors, then override individual floor numbers. Blank fields retain
existing counts, including mixed values. Changes only apply to selected buildings that
contain the corresponding floor; add missing floors using the existing Add floor action.
The review step shows before/after counts for each affected building and floor.

`PUT /api/management/projects/:projectId/structure` accepts a bounded list of building
IDs, expected SHA-256 layout versions, and floor IDs with target counts. Identity comes
from the session; JSON content type, exact origin, body size (128 KiB), and capacity limits
are enforced. Grants and every building are locked and checked before writing. A batch
containing any unauthorized target fails atomically. Building managers may change only
buildings explicitly assigned to them, including in mixed-residency/staff situations.

Versions cover names, addresses, floor identities/numbers and apartment identities/numbers.
A stale version rejects the whole transaction. Existing units retain IDs, labels and
relationships. New units receive the first available positive numeric label in their
building. Decreases remove the last naturally sorted labels in the affected floor only
if they have no household (including inactive), ownership, invitation or join-request
references. Apartment row locks prevent concurrent FK insertions from racing this check.
No floor, building, household or identity is deleted by this endpoint. A referenced unit
rejects all targets with `LINKED_APARTMENTS`, requiring an explicit refresh and adjustment.

Building creation, editing and setup accept optional address text (up to 500 characters).
Address changes participate in optimistic conflict checks, while old callers changing
only names leave addresses untouched. Apply independent migration 0007 before deploying;
no Supabase SDK or runtime dependency is added. Production data is not modified by the PR.

Tests cover variable generation, zero floors, bounds and numbering, localized setup and
bulk review flows, address editing, mixed counts, scope isolation, stale snapshots,
rollback, and linked apartment protection. The PostgreSQL tests run in CI against an
isolated database after applying all migrations.
