# Resident identity and directory authorization

Apply `database/migrations/0004_resident_identity.sql` after migration 0003, using the existing SQL migration workflow. SQL migrations remain authoritative.

## Identity provisioning

`user_person_links` maps one authenticated `app_users.id` to one `people.party_id`. Both columns are unique; deleting either identity removes the link. The required `verified_by` records a different existing user; deleting that verifier is restricted while links reference them.

There is deliberately no public link-creation API. A trusted database administrator must verify identity outside the application and provision the link using parameterized SQL with the intended user, person and verifier UUIDs. The verifier column records provenance, not a database role check: the application database credential must remain server-only and restricted to trusted operators. Do not infer links from email, names, apartment ownership or `households.created_by`. An authenticated user cannot claim a resident by supplying a UUID. A future manager workflow must authorize the actor and scope before any mutation.

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

Unit tests cover the scope rules and HTTP identity/cache/error boundary. `AUTH_TEST_DATABASE_URL` enables integration tests against an explicitly disposable PostgreSQL database after all four migrations. CI runs both auth and directory integration suites. Fixtures verify actual joins, visibility filtering, identity constraints and immediate changes to approval/settings/roles/links. Tests remove only their fixture UUIDs.

Existing UI remains synthetic and is not connected to this endpoint. No new UI, translation strings, animations, loading states or Storybook stories are needed for this server-only change. Screenshots remain manual. Manager assignment/approval/link mutations, organization directories, child/household editing and the first real-data UI flow require separate authorized endpoints and focused PRs. Do not expose development CRUD in production or treat this read policy as mutation authorization.
