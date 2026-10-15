# Development-only residential structure CRUD

Endpoint: `/api/dev/structure` (POST, PATCH, DELETE). Available **only** when `NODE_ENV=development`; returns 404 otherwise. This is a temporary local development tool, **not** a production API.

- POST: `{ "entity": "project", "name": "Community", "city": "Sderot" }`
- POST: `{ "entity": "building", "projectId": "<uuid>", "name": "A" }`
- POST: `{ "entity": "floor", "buildingId": "<uuid>", "number": 0 }`
- POST: `{ "entity": "apartment", "buildingId": "<uuid>", "floorId": "<uuid>", "number": "1" }`
- PATCH: entity, id, and editable fields for that entity.
- DELETE: entity and id. **Warning:** PostgreSQL foreign-key cascades can delete nested structures and related household data.

Requires local `DATABASE_URL` and the authoritative SQL migrations. Input is validated with Zod. Foreign-key and uniqueness constraints are enforced by PostgreSQL; database errors return HTTP 409. Missing update/delete records return HTTP 404.

This endpoint must not be enabled in shared development environments with real resident data. Do not set `NODE_ENV=development` in production. Before any deployment, replace this temporary interface with authenticated, project-scoped operations.

Read operations are available through the existing internal `getProjectStructure(projectId)` server-side query; no public GET endpoint is provided.
