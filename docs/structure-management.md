# Authorized structural additions and label changes

The live `/manage?project=<uuid>` workspace supports adding buildings, floors and apartments, renaming buildings, and changing floor/apartment numbers. Existing records are updated in place, preserving their IDs and relationships. There are no project edits, deletions, moves, occupancy changes or resident mutations in this workflow.

| Actor                        | Add building      | Rename building / add or renumber floors and apartments |
| ---------------------------- | ----------------- | ------------------------------------------------------- |
| Global administrator         | Any project       | Any building                                            |
| Project manager              | Assigned projects | Every building in assigned projects                     |
| Building manager             | No                | Assigned buildings only                                 |
| Resident without staff grant | No                | No                                                      |
| Anonymous                    | No                | No                                                      |

Independent grants combine. Resident directory visibility, ownership and identity links never authorize structural writes. The hierarchy DTO now includes a server-derived `canAddBuilding`; other structural actions are presented only for buildings already returned within the actor's management scope. These are presentation hints; the write service independently authorizes each request.

## Endpoint and contracts

`POST /api/management/projects/:projectId/structure` accepts one strict discriminated payload:

- `{ entity: "building", name }`
- `{ entity: "floor", buildingId, number }`
- `{ entity: "apartment", floorId, number }`

`PATCH` on the same endpoint accepts `{ entity, id, name, expected }` for a building or `{ entity, id, number, expected }` for a floor/apartment. `expected` is the previously read name/number, not a client-generated version. If the current value differs, the update returns 409 `STALE_STRUCTURE` instead of overwriting it. This is a value comparison, not a full edit-history/version tracker.

The route project is authoritative. Apartment creation derives `buildingId` from the authorized floor; clients cannot supply a competing building. Patches accept only label fields and cannot change parent IDs. Name/apartment labels are trimmed, nonempty strings of at most 200 characters. Textual apartment numbers remain supported. Floor numbers are signed PostgreSQL-range integers, including ground and negative floors. Existing database uniqueness applies: exact building names within a project, floor numbers within a building, apartment numbers throughout a building (including across floors). String labels such as `2` and `02` remain distinct; no new normalization/uniqueness migration is introduced.

Only verified Better Auth identity reaches the service. Transactions lock current global/staff grants before applying scoped writes, serializing grant revocation with mutation. Building-level locks serialize structural changes within a building; database uniqueness still arbitrates concurrent building creation. Parent resolution is constrained in SQL to the requested project and authorized buildings, and mutations return only `{ id }` (201 for create, 200 for update). Household, ownership, staff-assignment and identity rows are never rewritten.

Anonymous requests receive 401. Invalid, missing and unauthorized structural/project targets share generic 404 responses. Invalid payloads receive 400; duplicate labels/numbers return 409 `DUPLICATE_STRUCTURE`. JSON bodies are bounded to 4 KiB (413); JSON content type is required (415). All writes require the exact configured auth origin. All success and failure responses use `Cache-Control: private, no-store` and `Vary: Cookie`. Unexpected errors remain generic. Existing development-only structural CRUD routes remain internal prototypes and are not promoted to production APIs.

## UI and validation

Buttons live beside the building, floor or apartment they affect. Existing dialogs, inputs, feedback, transitions and reduced-motion styles are reused, with Hebrew RTL, English and Russian dictionaries. Empty buildings/floors remain actionable. The form validates numbers without treating absent residents as vacancy. Pending submissions block double writes and cancellation; successful writes close the editor and revalidate the persisted hierarchy/counts. Nothing is optimistically added or renamed in the live tree.

Drafts survive temporary hierarchy revalidation. Loss of project/building access closes the editor and clears the read workspace, aborting concurrent reads so late responses cannot restore unauthorized content. Project navigation remounts the workspace and aborts obsolete writes; client cancellation cannot undo a transaction already committed. Stale edits and uncertain network/server failures require an explicit refresh before retry. Duplicate conflicts preserve the draft so another value can be chosen. Keyboard focus returns to the workspace heading after closing.

Synthetic Storybook stories cover editor variants, busy/revalidation, duplicate, stale and uncertain states without authenticated requests. Screenshots remain on demand.

`structure-management.integration.test.ts` runs in the existing disposable migrated PostgreSQL job. It exercises verified sessions, forged identity, directory-only residents, all management scopes and combined grants, cross-project isolation, persisted create/update flows, preserved household/ownership/staff/identity links, database uniqueness, concurrent conflicts, stale-value protection, forbidden parent changes, exact origin checks, revoked grants and expired sessions. Unit/client tests exercise API bounds/cache/error handling, typed contracts, natural/text labels, UI capabilities, localized validation, double submission protection and stale read/write suppression.
