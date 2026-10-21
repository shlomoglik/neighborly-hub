# Live management workspace

`/manage` requires a verified Better Auth database session and lists authorized project cards. Opening a card navigates to `/manage/project/<uuid>`, with a management → project breadcrumb. Legacy `/manage?project=<uuid>` links redirect to that page. The setup wizard, invitations and staff links use the same project URL. Direct project links remain independent of discovery pagination.

The project page uses the wizard's `ProjectStructureEditor` inline through `ManagedStructureEditor`, one selected authorized building at a time. The duplicate floor/apartment tile forms and layout-mode buttons are removed from this flow. Users edit floor levels, names, types and units with the same controls as setup, then explicitly save that building using the existing atomic, version-checked PUT endpoint. Adding a building retains the independently authorized structural create endpoint. Switching buildings or explicitly refreshing with unsaved changes requires confirmation; Cancel resets the current draft.

## Read API and authorization

- `GET /api/management/projects?page=1`: at most 20 project IDs, names and cities, `page`, `hasNext`, and server-derived `canCreateProject` / `hasManagementAccess` capabilities. Pages are bounded to 1–10000, following directory pagination conventions.
- `GET /api/management/projects/:projectId`: project ID/name/city, authorized buildings, floors and apartments, and structural counts within that authorized scope. Empty buildings and floors remain visible. Floors sort numerically; apartment labels use natural numeric ordering with a fixed locale and ID tie-breaker. Text labels remain supported.

Global admins can browse all projects and create projects through the existing independently authorized setup endpoint. Project managers see their assigned projects and every building therein. Building managers see only their independently assigned buildings in each project. Multiple assignments combine. Residents without staff grants and anonymous users have no management access. Resident directory visibility, household membership and ownership play no part in management authorization.

Every read uses SQL `EXISTS` predicates against current global/staff grants. No unauthorized buildings or structural totals are fetched into application memory. Each operation runs in a read-only repeatable-read transaction for a consistent authorization/data snapshot; revocations take effect on the next request. Discovery uses a fixed number of queries; hierarchy uses two queries for the entire authorized project, without per-building requests. The hierarchy endpoint also returns `canAddBuilding` for global admins and project managers. It returns the complete authorized structure; building selection triggers revalidation and then filters that authorized DTO locally. Counts always describe the actor's entire authorized project scope.

Anonymous API requests receive 401. Malformed, nonexistent and unauthorized detail identifiers all receive the same generic 404. Invalid pagination receives 400. Unexpected failures receive generic 500 responses without exception details. Server logs record the failing operation and a bounded PostgreSQL SQLSTATE code when available, excluding exception messages, SQL, parameters and identity data. All responses, including errors, use `Cache-Control: private, no-store` and `Vary: Cookie`.

DTOs contain no residents, households, contacts, ownership, identity links, raw roles or session values. Structural apartments do not establish occupancy. The shared editor displays unit labels and types without resident or occupancy information.

## Client coordination

The API adapter, `useManagement` coordinator and pure `ManagementWorkspace` presentation are separate. All request keys immediately invalidate the previous discovery/hierarchy during render. Obsolete requests are aborted and late responses ignored even if a transport ignores cancellation. Errors never fall back to mocks or another project. A revoked selected building shows an unavailable state until the user explicitly changes selection.

Revalidation runs on the refresh action, focus, visibility and page lifecycle events. The management workspace does not poll. The inline draft and its original expected version survive revalidation while editing is disabled; revoked access removes the editor. Save conflicts require explicit reload. Server-side authorization is checked on every read and mutation. Expired sessions show a sign-in action; network/server failures have explicit retry. Project loads use reduced-motion-aware skeletons. Explicit refresh restores heading focus. Hebrew RTL, English and Russian share typed dictionaries.

Storybook mounts only synthetic presentation fixtures; it never calls authenticated APIs. Screenshots remain on demand.

## Validation and scope

`management.integration.test.ts` runs against migrated disposable PostgreSQL in the database CI job. It exercises verified sessions, forged identity claims, the authorization matrix, multiple grants, cross-project isolation, scoped counts, actual hierarchy reads, resident-directory separation, pagination, empty structures, ordering and revocation/expiry. Setup integration additionally reads the created structure through the management service. Client tests cover stale-response suppression, invalidation, revalidation, localized states, capability-based creation and direct setup navigation.

The workspace supports [authorized structural additions and label changes](structure-management.md). Global administrators can now provision and revoke scoped staff assignments for existing registered accounts; see [staff management](staff-management.md). Structural deletions/moves, resident onboarding, approval mutations and approval counts remain outside this workflow.

Project management includes a link to [scoped invitations and join request review](invitation-onboarding.md). Staff invitation issuance/review is administrator-only; resident invitations follow project/building grants.
