# Building hierarchy read model

The internal `getProjectStructure(projectId)` query returns a project and its buildings, floors, and apartments. It returns `null` for an unknown project and retains empty buildings and floors.

- The SQL baseline remains authoritative; no migrations are required.
- The query intentionally excludes residents, household members, contact details, and ownership.
- This module is **not** an API endpoint. Authentication and project-scoped authorization must be implemented before exposing the query to clients.
- The projection is scoped to one project and ordered by building name, floor number, and apartment number. Apartment numbers are strings, so their ordering is lexicographic.
- The query performs two database round trips (project lookup and a single joined hierarchy query) rather than one query per building.
- No production data is accessed in unit tests; the pure hierarchy transformation is independently testable.
