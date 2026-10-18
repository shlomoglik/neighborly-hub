# Private family members and existing-household invitations

Apply authoritative SQL migrations 0001–0006 before deploying. Migration 0006 extends existing invitation scope and child-profile provenance; it preserves existing memberships, identity links and pending invitation requests. No new environment variable or dependency is required. Never run the legacy Supabase migration.

## Permissions and privacy

The live household profile links representatives to `/household/:id/members`. The server requires an approved active household, a verified account/person link to an adult, and `household_members.is_contact_person`. Other residents, household creators, children, scoped managers and global administrators have no override to read this private page or mutate its children. A manager who is separately a representative uses that verified membership, independently of their management grants.

Representatives can create child profiles with a name and optional relationship, edit those profiles, and confirm their deletion. New records are always children, never representatives, and cannot be attached to an existing supplied person ID. They have no login, contact data or birthday fields. All directory and ordinary household detail endpoints continue excluding all children for every reader. Existing/legacy child records remain visible only to representatives on this private page, but cannot be edited through the new provenance flag unless created by this workflow. Adult identities, adult membership removal, representative delegation, child-to-adult promotion, ownership and moves are not editable here.

`is_managed_child` records provenance on the membership, defaults to false and is checked against the representative flag in SQL. Edit/delete additionally require a child with exactly one household membership and no identity link, contacts, ownership or organization contact references. These checks avoid treating this endpoint as a global person editor. Removing an eligible profile deletes its membership and person/party atomically. A child addition carries a per-household UUID `creation_key`: a saved identical retry returns the saved member; changed payloads conflict while that profile exists. It is not a durable operation log after profile deletion. Expected name/relation values protect edits/deletion against stale writes.

Member reads have stable pages of 20. Child additions and adult approvals serialize on the household and cap it at 50 members. Existing larger households stay readable. The same person cannot get duplicate membership in a household. Adding one member never transfers or removes their memberships elsewhere.

## Adult invitation flow

Only a current adult representative can issue `household_member` invitations through the household endpoint. The server derives project/building/apartment/household scope; the body cannot choose identities, roles or another household. The new composite `(household_id, apartment_id)` FK, together with existing apartment/building/project FKs and kind/scope CHECKs, prevents cross-apartment/project binding. The link is single-use, expires in 1–90 days (default seven), supports the existing optional verified recipient restriction, and stores only the token hash. At most 20 unexpired/unrevoked links may exist for a household; a consumed link still counts until revoked or expired.

The representative gets the link once and reuses local printable/downloadable QR, copy, WhatsApp recipient/manual number and mailto sharing. Messages are sent by the user. The private page lists bounded invitation metadata and supports confirmed revocation. Authorized managers can also see/revoke these invitations through their existing scoped management workspace. Neither the token, hash nor child records are returned by list endpoints.

Opening the link requires sign-in and shows only the existing minimal project/building/apartment context, never household or child names. Submission accepts only `{ fullName }`, creates a pending request and consumes the link atomically. It cannot choose an apartment, create/rename a household, provide a person ID or gain access. The issuer cannot claim their own link. Saved submissions are idempotent for their original account, as with existing invitations.

An authorized manager reviews through the existing project/building queue. Representatives without a management grant cannot approve. Approval rechecks and locks issuer authority, current invitation/recipient/scope and the target household. It reuses the applicant's verified global person or provisions a new adult person/link with reviewer provenance, then adds a non-representative membership to the existing approved active household. Existing household fields, other members, contact values, ownership and global identity names remain unchanged. Existing membership is reused without changing its privileges. A child-linked account is rejected; there is no matching or identity merging by name, phone or email. Account email shown in the manager review is authenticated account data.

Issuer authority is revalidated on context reads, submissions, queue refresh and approval. Losing representative status invalidates this kind of invitation even if the issuer retains an admin/staff grant. Expiry, revocation or an inactive/rejected/replaced target blocks approval; rejection remains available after invitation expiry/revocation. Revocation never removes previously approved membership. A replacement household in the same apartment cannot inherit the old invitation.

## HTTP and client boundaries

| Endpoint                                               | Purpose                                                                |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `GET /api/households/:id/members?page=1`               | Private representative-only member page and add capability             |
| `PATCH /api/households/:id/members`                    | Strict `addChild`, `updateChild`, `removeChild` action                 |
| `GET /api/households/:id/invitations?page=1`           | Representative-only household invitation metadata                      |
| `POST /api/households/:id/invitations`                 | Strict optional `recipientEmail` and `expiresInDays`; returns URL once |
| `DELETE /api/households/:id/invitations/:invitationId` | Representative revocation                                              |

All routes verify database sessions, validate UUIDs and page bounds, return private/no-store responses with `Vary: Cookie`, and use the existing exact-Origin, strict streamed 4096-byte JSON write boundary. Missing/unauthorized identifiers share a 404. No public identity search or arbitrary binding is added.

Representative mutations lock verified identity/person before household membership/household. Invitation submission/revocation/approval lock the invitation before checking issuer grants. Approval locks existing applicant identity before household membership changes, consistently with self-service contact edits. This prevents stale grants from being used and serializes member limits. Old read snapshots are discarded on revalidation; scope changes/backgrounding abort reads and ignore late responses. Denied writes invalidate concurrent reads and clear secret link state. Writes never retry automatically; uncertain outcomes require refresh and inspection. Drafts and secret URLs are not persisted in browser storage. Hebrew/English/Russian text, responsive components, skeletons, reduced-motion styles and focus handling are reused. Storybook remains fictional; screenshots are on demand.

## Verification

`family.integration.test.ts` uses actual signed Better Auth sessions and disposable migrated PostgreSQL in CI. It covers representative/staff separation, child exclusion, idempotent creation, stale writes/deletion, scope/recipient forgery, unchanged global identity across projects, manager review/append without takeover, issuer revocation despite admin grants, expiration/revocation, SQL constraints, private pagination, concurrent member limits and rollback of failed identity provisioning. Existing invitation and household integration suites run against migration 0006 to cover backward compatibility. Component/contract tests cover localized child forms, stable retry keys, confirmation, private loading/denied states, invitation defaults and name-only adult joins.
