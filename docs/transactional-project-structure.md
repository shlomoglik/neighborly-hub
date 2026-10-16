# Atomic project structure creation

Development-only endpoint: `POST /api/dev/project-structure`.

Example request:

```json
{
  "name": "Community",
  "city": "Sderot",
  "buildings": [
    {
      "name": "A",
      "floors": [{ "number": 0, "apartments": [{ "number": "1" }, { "number": "2" }] }]
    }
  ]
}
```

Returns `201 { "projectId": "<uuid>" }` on success.

The server validates the nested input with Zod, then inserts the project, buildings, floors and apartments inside one Drizzle `db.transaction()`. A failed insertion rolls back the entire hierarchy. Existing PostgreSQL uniqueness and foreign-key constraints remain authoritative.

The endpoint returns 404 outside `NODE_ENV=development`; it is not authenticated and must never be exposed with real resident data. The existing per-entity CRUD remains available for editing individual records.

The same hierarchy writer is used by the [authenticated setup workflow](project-setup.md), which owns a separate admin authorization boundary and accepts a compact, bounded payload. `src/lib/access/project-setup.integration.test.ts` exercises this TypeScript transaction against PostgreSQL, including rollback when a later building has duplicate apartment numbers. CI runs this suite against its disposable migrated database.
