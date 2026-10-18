# Invitation onboarding

Apply authoritative SQL migrations 0001–0005, in order. Migration 0005 adds `invitations` and `join_requests`, composite structural foreign keys, normalized recipient restrictions, token uniqueness, payload/review constraints and pagination indexes. Do not run the legacy Drizzle/Supabase migration.

## Account and membership boundary

An account is global. Staff assignments and household membership belong to projects/buildings/apartments and can accumulate independently. A resident request never creates another login. Approval reuses an existing verified `user_person_links` person without changing that person's name or existing memberships; otherwise the approving manager provisions a person, link, approved active household and membership atomically. The approver records identity verification provenance and must verify the applicant before approval. No matching by name or phone, no contact/ownership inference, and no takeover of an existing household.

The initial resident flow creates one adult member for an apartment without an active household. Joining an occupied household, adding family members/children, contact collection, ownership and household moves require separate workflows. Pending join requests do not create households, reserve apartments or grant directory/management access. The partial active-household uniqueness constraint and apartment row lock prevent two concurrent approvals from occupying one apartment. A user row lock serializes person provisioning across projects.

## Invitation types and authorization

| Type                      | Scope                                                | Issuer/reviewer                                                  | Use                    |
| ------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- | ---------------------- |
| Resident, fixed apartment | Project, building, apartment                         | Global admin; project manager; building manager in that building | One request            |
| Resident, building        | Project and building; applicant selects an apartment | Same scoped management policy                                    | Reusable QR/group link |
| Project manager           | Project                                              | Global admin                                                     | One request            |
| Building manager          | Project and building                                 | Global admin                                                     | One request            |

Independent staff grants combine; resident directory visibility grants no invitation management rights. Creation, discovery, revocation and review scope are enforced in SQL using verified session identity. Grants are loaded on every request. Reads use a read-only repeatable-read snapshot; writes lock current grants, invitation/request rows and affected identity/apartment rows. Approval rechecks the issuer's current authority, expiry, revocation, recipient restriction, scope and apartment availability. A manager cannot review their own request. Rejection grants no access and is allowed after expiry/revocation. Revoking an invitation does not revoke a previously approved residency/staff assignment.

An optional email restriction binds to the stable ID of an existing verified account, without exposing an account-search API. For a future account, verified matching email is required. An unrestricted link can be claimed by any signed-in account; its eventual access still requires an authorized reviewer. A delivery phone or email prefill is not proof of identity. The account email shown in a review belongs to the authenticated applicant, not the user-entered resident name.

Tokens contain 256 random bits. Only SHA-256 hashes persist; the full URL is returned once on creation and must be copied/printed then. It cannot be retrieved later. URLs use configured `BETTER_AUTH_URL`, never the request's Host header. Opening a link, crawler/prefetch GET or OAuth redirect never consumes it. A single-use link is consumed only when a request transaction commits; retries by the same account return its saved request. Reusable building links accept one request per account per link. A rejected/consumed single-use link requires a new invitation for another attempt. Existing requests remain visible to their applicant after expiry/revocation; no other applicant can open the inactive link.

## HTTP contracts

All endpoints require a verified database session, return `Cache-Control: private, no-store`, `Vary: Cookie`, and `Referrer-Policy: no-referrer`. Anonymous requests receive 401; invalid/missing/unauthorized detail identifiers share generic 404. Writes require exact configured Origin and a bounded JSON body (4096 bytes). Unexpected errors return a generic 500. Typed input schemas reject extra identity/role parameters. Pages are 1–10000 with 20 items and `hasNext`, following repository conventions.

| Endpoint                                                               | Behavior                                                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET /api/management/projects/:projectId/invitations?page=1`           | Scoped metadata and server-derived `canInviteStaff`; no token/hash or raw role records                              |
| `POST /api/management/projects/:projectId/invitations`                 | Strict kind/scope, optional `recipientEmail`, `expiresInDays` 1–90 (default 7); returns `{id,url}` once             |
| `DELETE /api/management/projects/:projectId/invitations/:invitationId` | Revoke scoped invitation                                                                                            |
| `GET /api/management/projects/:projectId/join-requests?page=1`         | Scoped requests, submitted names, applicant account name/email and `canReview`; no user IDs/session/contact records |
| `POST /api/management/projects/:projectId/join-requests/:requestId`    | `{decision:"approve"                                                                                                | "reject"}`; authoritative transaction, no optimistic grant |
| `GET /api/join/:token?page=1`                                          | Minimal project/building context and paginated apartment labels, or caller's existing request status                |
| `POST /api/join/:token`                                                | Resident `{apartmentId,fullName,householdName}` or staff `{}`; saves pending request                                |
| `GET /api/join/requests?page=1`                                        | Caller-owned requests across projects                                                                               |

Approval conflicts return 409 (`APARTMENT_OCCUPIED`, `IDENTITY_UNAVAILABLE`, `REQUEST_REVIEWED`, `INVITATION_INACTIVE`); self-review returns 403. A deleted issuer grant makes further claims/approvals unavailable. No public account directory or arbitrary user/person identity binding is introduced.

## UI and sharing

The management project links to `/manage/invitations/:projectId`. `/join/:token` requires Google sign-in and preserves only a validated local invitation return path; `/join` shows the account's requests across projects. The invitation page uses no-referrer/noindex headers. Configure infrastructure logs/analytics to avoid capturing invitation token paths; tokens are bearer secrets until consumed/expired/revoked. No tokens are stored in browser persistence.

API adapters, abortable resource/action coordination and presentation are separate. Scope/page changes, focus/visibility and visible 30-second revalidation discard previous data; late reads and writes are ignored. Denied writes invalidate the view. Writes never automatically retry; ambiguous failure requires refresh and inspection. All new UI states use typed Hebrew/English/Russian dictionaries and existing components/tokens. Storybook renders synthetic props only.

QR codes are generated locally with pinned `qrcode`, because the existing stack has no QR encoder. Download is SVG; print includes project title, QR and full URL. No remote QR service receives the invitation. WhatsApp sharing uses `https://wa.me/<international-phone>?text=<encoded-message>`; a generic `wa.me/?text=...` opens recipient selection for personal chats or groups where the installed client supports it. A manager may select a phone from their already-authorized resident directory, type an international number (Israeli local `0` numbers normalize to `972`), or send to themselves and forward. The URL only opens a prepared message; the user sends it. Mail uses `mailto:` with encoded subject/body and optional recipient, opening the configured mail client. No WhatsApp Business API, automated email service or automatic group delivery is claimed.

## Verification

`invitations.integration.test.ts` uses actual Better Auth signed sessions and migrated disposable PostgreSQL in the existing CI database job. It covers authorization/forged identity, cross-project isolation, real approval/grants, hash-only storage, idempotency, reusable links, concurrent apartment approval, person reuse across projects, verified-recipient restrictions, expiry/revocation, self-review, and pagination. Unit/component tests cover HTTP privacy/body/origin boundaries, local QR/share links, safe return paths, localized capabilities/states and stale-response cancellation. Google consent and actual WhatsApp/mail-client sending remain deployment/device smoke checks.
