# Live household profiles and self-service contacts

Requires authoritative migrations 0001–0006 and the existing Google authentication configuration. No new migration, dependency or environment variable is required.

## Behavior and ownership

`/household` lists the signed-in account's approved active households across projects. `/household/:id` replaces the old mock profile and can be opened from the live directory. The account page and application navigation link to My households. Staff assignments do not create resident memberships or add items to that list.

Only adult members are displayed, in stable pages of 20. Children, birth dates, ownership and identity-verification metadata are not returned. Ownership is never inferred from residency. Neighbor access follows the existing project/building directory policy. Scoped managers can inspect contact values only within their grants. An adult member can read their own approved household independently of directory settings.

A verified linked adult with `household_members.is_contact_person` may rename that household. Every verified linked adult member may add, edit or delete **their own** phone/email records. Being a representative, manager, administrator, household creator or relative does not authorize editing another person's contacts. Edits cannot change identity links, personal names, apartment, approval status, membership, ownership or roles.

Contact methods belong to the global person, not to a project or household. The editor explains that values, visibility changes and deletion apply in all projects containing that person. Deletion requires confirmation. New contacts default to managers-only visibility. Building/project visibility uses the existing server-side directory rules; it does not override a project's building-only directory setting. No contacts are copied into login email/phone records.

The separate [private family workflow](family-membership.md) now manages child profiles and reviewed invitations into occupied households. Delegating representative privileges, adult removal, ownership and household moves remain follow-up work.

## API

All routes verify the database session. Every success/error response is `private, no-store` and varies by cookie. UUID and pagination inputs are validated. Unauthorized/missing/pending/inactive details share a generic 404. Writes require the exact configured Origin and streamed JSON bodies of at most 4096 bytes; schemas reject unknown fields and invalid contact values.

| Endpoint                         | Contract                                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `GET /api/households?page=1`     | Caller-owned approved active adult households; 20 per page                                                  |
| `GET /api/households/:id?page=1` | Authorized summary, adult member page, server-derived `canRename`, and caller's editable contacts or `null` |
| `PATCH /api/households/:id`      | One strict action: `rename`, `addContact`, `updateContact`, `deleteContact`                                 |

Rename includes the previously read `expected` name. Contact update/delete include the previously read fields as `expected`; the server compares those values while holding locks and returns `409 STALE_HOUSEHOLD` on mismatch. This is value-based conflict detection, not a version/history system. Creation serializes on the verified person and rejects an existing kind/value (`409 DUPLICATE_CONTACT`), including retries from another household. Creation is capped at 10 contacts per person (`409 CONTACT_LIMIT`); legacy contacts above the cap remain readable/editable/deletable. Phone values require 5–40 characters, at least five digits and phone punctuation; email addresses use shared Zod validation.

Writes lock the verified identity/person first, followed by the household membership/household and affected contact. Identity unlinking, child status changes, representative revocation and household deactivation serialize against mutations. Manager grants never substitute for edit rights. Contact reads filter other people's private values in SQL before constructing DTOs. Reads use a read-only repeatable-read snapshot.

## Client lifecycle and verification

The existing invitation private-request/resource/action implementation is shared through `features/shared` with compatibility exports for invitation callers. It aborts obsolete work, suppresses late responses and discards read snapshots on scope, focus, visibility and 30-second visible refresh. Denied mutations also invalidate in-flight reads. Writes never retry automatically; ambiguous failures instruct refresh/inspection. Drafts survive ordinary read revalidation, remain hidden while data is unavailable, and are cleared on authorization denial. New detail identities remount their workspace. No profile/contact data is stored in browser persistence.

Hebrew, English and Russian text, existing responsive components, skeletons, motion/reduced-motion styles and focus restoration are reused. Storybook examples are fictional and never call live APIs. Screenshots remain on demand.

`households.integration.test.ts` runs in the existing disposable PostgreSQL CI job using actual signed Better Auth sessions. It exercises private HTTP boundaries, identity spoofing/expiry, multi-project memberships, contact visibility, child exclusion, management/edit separation, persisted edits, directory reflection, expected-value conflicts, concurrent writes/contact limits, pagination and revocation. Unit/component tests cover JSON boundaries, translations, contact validation, editor defaults, drafts, confirmations and loading/denied states. Existing shared lifecycle tests continue to exercise races, backgrounding and invalidation through the invitation compatibility exports.
