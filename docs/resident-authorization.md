# Resident identity and directory authorization

Apply `database/migrations/0004_resident_identity.sql` after migration 0003, using the existing SQL migration workflow. SQL migrations remain authoritative.

## Identity provisioning

`user_person_links` maps one authenticated `app_users.id` to one `people.party_id`. Both columns are unique; deleting either identity removes the link. The required `verified_by` records a different existing user; deleting that verifier is restricted while links reference them.

There is no arbitrary public identity-link API. A trusted database administrator can provision verified links using parameterized SQL, or an authorized manager can verify and approve an invitation request through the scoped [onboarding workflow](invitation-onboarding.md). Approval reuses an existing linked person, or creates a new person and records the reviewing manager as verifier. The verifier column records provenance, not a database role check: the application database credential must remain server-only and restricted to trusted operators. Do not infer links from email, names, apartment ownership or `households.created_by`. An authenticated user cannot claim a resident by supplying a UUID. Invitation approval authorizes actor and scope before any mutation. Existing people are never claimed by name, email or supplied person UUID.

## Read boundary

`GET /api/projects/:projectId/directory` verifies the current database session and passes only that user's ID to the server-only service. Anonymous requests receive 401. Invalid, missing and unauthorized project IDs all receive 404. Responses use `Cache-Control: private, no-store` and `Vary: Cookie`. Database failures propagate; they do not fall back to public or mock data.

| Actor                                                | Visible directory buildings                | Contacts                                                        |
| ---------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------- |
| Unlinked, pending, rejected or inactive resident     | None                                       | None                                                            |
| Linked approved active resident; community directory | All in their project                       | Project contacts; building contacts only in their own buildings |
| Linked approved active resident; building directory  | Their own buildings                        | Project and building contacts in those buildings                |
| Building manager                                     | Assigned buildings in the selected project | All visibility levels in assigned buildings                     |
| Project manager                                      | Selected assigned project                  | All visibility levels                                           |
| Global admin                                         | Selected project                           | All visibility levels                                           |

Independent grants combine: a building manager who is also an approved resident may read a wider resident directory, but manager-only contacts remain limited to their managed buildings. Unknown directory settings fail closed for resident grants. Staff assignments and membership are loaded afresh per request, without an authorization cache.

This endpoint is a directory, not a moderation queue: even managers see only active, approved households. Children and all child contacts are excluded for every actor. No birth dates, account IDs/emails, verifier IDs, roles, session data or approval metadata are serialized. A person belonging to multiple visible households appears once per household. Contact values are filtered in the database join; private values never reach the DTO mapper or HTTP response. Directory results have deterministic ordering. A read-only repeatable-read transaction gives each request a consistent authorization/data snapshot; revocations take effect on the next request.

## Verification and scope

Unit tests cover the scope rules and HTTP identity/cache/error boundary. `AUTH_TEST_DATABASE_URL` enables integration tests against an explicitly disposable PostgreSQL database after all current migrations. CI runs both auth and directory integration suites. Fixtures verify actual joins, visibility filtering, identity constraints and immediate changes to approval/settings/roles/links. Tests remove only their fixture UUIDs.

## Live directory

`/directory` requires a verified session before rendering. Google sign-in returns here; the account header link provides profile/sign-out. The page discovers projects through `GET /api/directory/projects`, whose DTO contains only authorized project and building IDs/names. Discovery and directory reads use the same grant loader and scope policy. A building manager does not discover other buildings. Empty discovery is explained as missing approved access, without exposing whether an identity link or household exists.

The directory endpoint accepts `query` (trimmed, at most 100 characters), `buildingId` (optional UUID), and `page` (integer 1–10000). Invalid filters return an uncached 400. Search covers authorized adult names, household names and apartment numbers, case-insensitively; `%`, `_` and backslash are literal search characters. Search never examines contact values or excluded children. Each response is `{ residents, page, hasNext }`, with at most 20 resident/household pairs. Stable SQL ordering and pagination occur before the contact join, so contacts cannot split a resident across pages. No total count reveals hidden rows. Building filters intersect existing scope and cannot widen it.

The client has no resident cache or persisted directory state. Fetches use same-origin credentials and `cache: no-store`. Every filter/page/project change immediately hides the previous list, debounces requests by 250ms, and aborts outdated work. Responses from aborted requests are ignored even if the transport delivers them. Project/building metadata is revalidated before each resident request. The initially selected project stays pinned across refreshes rather than silently switching when project ordering changes.

Visible tabs revalidate every 30 seconds and on focus. Hidden tabs and `pagehide` clear resident state; visibility return and `pageshow` revalidate, including restored browser pages. Loading uses the existing skeleton and entry motion, respecting reduced-motion preferences. Unauthorized, expired and failed requests remove old resident/contact values and show generic translated feedback. Revocation is enforced immediately on the next server request; a continuously visible client may display previously authorized data until its next 30-second poll or user-triggered refresh. This is polling, not a push subscription, and cannot retract information already read or copied. Pagination restores keyboard focus to the heading; filter inputs retain their focus while requests run.

`ResidentDirectory` is presentation-only; the request adapter and state hook are separate. Storybook uses fictional data and includes interactive filters/paging plus loading, empty, unlinked, error, expired and revoked states. All new UI strings are in Hebrew, English and Russian dictionaries. Real residents are never replaced by demo data on errors. The live page does not link real UUIDs to the synthetic household detail route.

Screenshots remain manual. Manager assignment/approval/link mutations, organization directories and child/household editing require separate authorized endpoints and focused PRs. Do not expose development CRUD in production or treat this read policy as mutation authorization.
