# Administrator-managed staff assignments

A global administrator can open a saved project in `/manage`, select **Manage staff**, and open `/manage/staff/:projectId`. The administrator enters the exact email of an existing registered account and chooses either project manager (all buildings in this project) or building manager (one explicitly selected building). Existing assignments can be revoked through a confirmation dialog naming the account and scope.

This manages existing `staff_assignments` rows only. It does not grant global administrator roles, create accounts, send invitations, create resident identity links, approve households or change structural data. Staff provisioning is separate from residency and ownership.

## API

| Method | Endpoint                                                  | Result                                                                                                                           |
| ------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/management/projects/:projectId/staff?page=1`        | Project ID/name, its building IDs/names, and a paginated list of assignment ID, account display name/email, role and building ID |
| POST   | `/api/management/projects/:projectId/staff`               | `{ assignmentId }`, status 201                                                                                                   |
| DELETE | `/api/management/projects/:projectId/staff/:assignmentId` | `{ removed: true }`, status 200                                                                                                  |

POST accepts the strict discriminated contract `{ email, role: "project_manager", buildingId: null }` or `{ email, role: "building_manager", buildingId: <uuid> }`. It rejects unknown fields, including forged account IDs and global role claims. Bodies are bounded to 4 KiB; JSON content type is required. Email is trimmed and lowercased, and compared exactly against normalized existing account emails. Zero or ambiguous matches receive `USER_UNAVAILABLE` (400); there is no searchable account directory or invitation side effect. Duplicate assignments receive `ALREADY_ASSIGNED` (409). Existing PostgreSQL NULLS NOT DISTINCT uniqueness also prevents duplicate project-manager grants under concurrent requests.

Only verified Better Auth session identity reaches the services. Anonymous requests receive 401; residents, project managers and building managers receive 403, even in their own projects. Global administrator permission is rechecked on every request. Read operations use a read-only repeatable-read snapshot. Writes recheck and hold a shared lock on the actor's global administrator grant inside the same transaction as the mutation, following project setup's locking protocol. Grant revocation and writes therefore serialize: a write that already holds the grant lock completes before revocation; a write after revocation is denied.

Building assignments must reference a building in the route's project. Deletes match both assignment ID and project ID; they cannot remove another project's assignment. The existing composite foreign key and assignment scope/role checks remain the database integrity boundary. Independent assignments combine, and deleting one does not remove other project or building grants. The next management read reflects the resulting scope; clients use the existing 30-second visible-tab polling and focus refresh, rather than push notifications.

Missing or malformed project/assignment identifiers and cross-project targets receive generic 404 responses. Errors never serialize SQL, raw account records or exception details. Successful responses and all failures use `Cache-Control: private, no-store` and `Vary: Cookie`. Both write methods require an exact configured `BETTER_AUTH_URL` origin through the existing auth configuration. No new environment settings or schema migrations are required.

Discovery pages use the existing 20-row, maximum 10000-page convention and deterministic email/role/building/ID ordering. Account metadata is exposed only to global admins and only for staff already assigned to the selected project. The management workspace uses its existing global-admin capability to present the staff action; page and API checks remain independently enforced.

## Client and verification

`staff-api`, `useStaff` and the pure `StaffWorkspace` separate HTTP, state coordination and presentation. Requests are aborted on navigation/unmount, late responses are ignored, and staff records disappear immediately when a request key changes or access expires/is revoked. Hidden/cached pages clear records, and visible tabs revalidate on focus, return and a 30-second interval. Duplicate writes are blocked while pending; successful writes reload persisted assignments without optimistic grants. Failed/uncertain writes preserve the form draft and never announce success. Network/server uncertainty explicitly instructs the admin to refresh and inspect assignments before retrying a write.

The responsive form, confirmation dialog, keyboard controls, loading skeletons and feedback use existing components and typed Hebrew, English and Russian strings. Storybook exercises only synthetic props and callbacks; it never mounts authenticated API adapters. Screenshots remain on demand.

`staff.integration.test.ts` runs in the existing disposable migrated PostgreSQL CI job. It covers real authenticated API lifecycle, anonymous/non-admin access and forged claims, project/building scope, grant composition and revocation, cross-project deletion protection, duplicate/concurrent writes, pagination, expired sessions, revoked admin rights and write-origin checks. Unit/client tests cover strict/bounded HTTP contracts, cache/error boundaries, page protection, localization, capability-based navigation, confirmation, duplicate submission suppression and obsolete reads/writes after navigation.
