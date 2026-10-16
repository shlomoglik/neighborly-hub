# Live management workspace

`/manage` requires a verified Better Auth database session. Discovery is paginated; selecting a project opens `/manage?project=<uuid>`. Refresh and direct links retain that selection, including projects outside the current discovery page. The setup wizard links its returned project ID directly to this workspace.

## Read API and authorization

- `GET /api/management/projects?page=1`: at most 20 project IDs, names and cities, `page`, `hasNext`, and server-derived `canCreateProject` / `hasManagementAccess` capabilities. Pages are bounded to 1–10000, following directory pagination conventions.
- `GET /api/management/projects/:projectId`: project ID/name/city, authorized buildings, floors and apartments, and structural counts within that authorized scope. Empty buildings and floors remain visible. Floors sort numerically; apartment labels use natural numeric ordering with a fixed locale and ID tie-breaker. Text labels remain supported.

Global admins can browse all projects and create projects through the existing independently authorized setup endpoint. Project managers see their assigned projects and every building therein. Building managers see only their independently assigned buildings in each project. Multiple assignments combine. Residents without staff grants and anonymous users have no management access. Resident directory visibility, household membership and ownership play no part in management authorization.

Every read uses SQL `EXISTS` predicates against current global/staff grants. No unauthorized buildings or structural totals are fetched into application memory. Each operation runs in a read-only repeatable-read transaction for a consistent authorization/data snapshot; revocations take effect on the next request. Discovery uses a fixed number of queries; hierarchy uses two queries for the entire authorized project, without per-building requests. The hierarchy endpoint returns the complete authorized structure; building selection triggers revalidation and then filters that authorized DTO locally. Counts always describe the actor's entire authorized project scope.

Anonymous API requests receive 401. Malformed, nonexistent and unauthorized detail identifiers all receive the same generic 404. Invalid pagination receives 400. Unexpected failures receive generic 500 responses without exception details. All responses, including errors, use `Cache-Control: private, no-store` and `Vary: Cookie`.

DTOs contain no residents, households, contacts, ownership, identity links, raw roles or session values. Structural apartments do not establish occupancy. The workspace uses neutral, noninteractive apartment tiles rather than occupancy-dependent `ApartmentMap` tiles.

## Client coordination

The API adapter, `useManagement` coordinator and pure `ManagementWorkspace` presentation are separate. All request keys immediately invalidate the previous discovery/hierarchy during render. Obsolete requests are aborted and late responses ignored even if a transport ignores cancellation. Errors never fall back to mocks or another project. A revoked selected building shows an unavailable state until the user explicitly changes selection.

Revalidation follows the directory approach: refresh action, focus, visible-tab polling every 30 seconds, visibility and page lifecycle events. Hidden/cached pages clear data and reload on return. Expired sessions show a sign-in action; network/server failures have explicit retry. Initial and selection changes use existing reduced-motion-aware skeletons and transitions. User-triggered loading restores keyboard focus to the selected building or workspace heading. Hebrew RTL, English and Russian share typed dictionaries.

Storybook mounts only synthetic presentation fixtures; it never calls authenticated APIs. Screenshots remain on demand.

## Validation and scope

`management.integration.test.ts` runs against migrated disposable PostgreSQL in the database CI job. It exercises verified sessions, forged identity claims, the authorization matrix, multiple grants, cross-project isolation, scoped counts, actual hierarchy reads, resident-directory separation, pagination, empty structures, ordering and revocation/expiry. Setup integration additionally reads the created structure through the management service. Client tests cover stale-response suppression, invalidation, revalidation, localized states, capability-based creation and direct setup navigation.

This feature is structural browsing only. Structural editing, staff provisioning/assignment, resident onboarding, approval mutations and approval counts remain outside this workflow.
