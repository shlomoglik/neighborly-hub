# Authenticated project setup

`/manage/setup` is the live four-step wizard (project details, structure, unit types, review). It requires a verified session and an existing `global_roles` row with `role = 'admin'`. Anonymous users are redirected to sign in; authenticated non-admins receive 404. A project manager or building manager cannot create a new project outside their assigned scope. Global roles must be provisioned by a trusted database operator; signing in with Google does not grant this role.

The client submits the shared Zod contract to `POST /api/projects/setup` using same-origin cookies. This endpoint is available in production, unlike the existing development CRUD. It verifies the current session, requires an exact `Origin` matching the validated `BETTER_AUTH_URL`, accepts JSON only, and limits the streamed request body to 12 MiB. The authenticated actor comes only from the verified session, never a body, query parameter, or header-supplied user ID. Responses are private and uncached.

Example request:

```json
{
  "name": "Community",
  "city": "Sderot",
  "buildings": [
    { "name": "A", "floors": 2, "unitsPerFloor": 3 },
    { "name": "B", "floors": 1, "unitsPerFloor": 2 }
  ]
}
```

Names are trimmed and limited to 200 characters. Building names must be unique after Unicode NFKC normalization and lowercasing. Counts are integers from 1 to 200. A project allows up to 100 buildings, 1,000 floors and 10,000 apartments in total. Unknown fields are rejected. The UI uses the same contract, including its aggregate limits, before enabling review or submission.

For legacy compact requests, floors are numbered from 0 (ground floor). Apartments are numbered from 1 consecutively across floors within each building, restarting at 1 in the next building. The example generates A/0 apartments 1–3, A/1 apartments 4–6, and B/0 apartments 1–2. The new wizard submits explicit structure rows instead; labels, levels and types are reviewed before confirmation.

The service re-reads the global admin grant under a PostgreSQL shared row lock inside the write transaction. Grant deletion serializes against an in-flight authorized write. It then expands the compact payload and uses the shared hierarchy writer from the development transaction service. Project, buildings, floors and apartments commit together; any insert failure rolls them all back. Migration 0008 adds the editable structure metadata; no new tables are needed. No resident records, memberships or staff grants are created.

Success returns `201 { "projectId": "<uuid>" }`. Missing sessions receive 401, missing global grants or untrusted origins receive 403, invalid JSON/input receives 400, oversized bodies receive 413, unsupported content types receive 415, and unexpected failures receive a generic 500 without database details. A successful creation appears in the existing authorized directory project discovery; the success view links to that live directory rather than the mock management screen.

The UI prevents concurrent submissions, locks wizard navigation while saving, shows skeletons and localized status text, and preserves the draft after errors. It handles expired sessions and revoked permissions separately. It never retries automatically. There is no cross-request idempotency guarantee: if a response is lost after commit, check the project list before submitting again. The generic failure message explains this uncertainty rather than claiming that nothing was saved. All new text has Hebrew, English and Russian translations.

Storybook injects a fictional create adapter and never calls the live write endpoint. The saving story lets reviewers hold the pending state after submitting the form. Screenshot capture remains opt-in.

Unit/component tests cover shared validation, numbering, API boundaries, page authorization, request serialization, localized success/error states and double submission. With `AUTH_TEST_DATABASE_URL` pointing to a disposable migrated PostgreSQL database, CI also runs `src/lib/access/project-setup.integration.test.ts`: real signed sessions, exact persisted hierarchy, discovery, rejected scoped roles, CSRF origin checks, revoked sessions/roles and rollback of the shared writer on a late PostgreSQL uniqueness failure.

## Visual structure editor

The wizard now submits optional `structure` arrays per building, preserving the compact request format above for compatibility. Each floor has an integer `number` (−1000…1000), optional `name`, required `type` and an ordered `apartments` array with unit labels and optional types. Detailed layouts must agree with `floors` and cannot also supply `floorUnits`. Names are unique within a building after trim/NFKC/case normalization; empty floors are valid. Array order is persisted as `apartments.position`.

Versioned drafts are stored in this browser only, with explicit restore/discard, quota-error feedback and conflict detection across tabs. This is not a server draft or cross-device synchronization. Existing buildings use an explicit transactional server save with optimistic concurrency; see [design analysis and implementation](visual-structure-editor.md).
