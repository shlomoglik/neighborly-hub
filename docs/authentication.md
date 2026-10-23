# Authentication foundation

Better Auth 1.7.10 manages Google OAuth, email/password authentication and database-backed sessions. The Drizzle adapter uses the existing PostgreSQL database; Drizzle ORM is pinned to 0.45.4 to meet the adapter's peer requirement. Passwords use Better Auth’s built-in scrypt hashing in the existing `auth_accounts.password` field. Optional email verification and recovery messages use Resend’s HTTPS API; no new dependency, table or migration is required.

## Configure

1. Apply SQL migrations `0001_initial.sql`, `0002_party_subtype_integrity.sql` and `0003_auth_sessions.sql` in order. SQL migrations remain authoritative; do not run the legacy Supabase migrations, `drizzle-kit push` or the Better Auth migration CLI against this database.
2. Set the three required server-only variables in `.env.example`: `DATABASE_URL`, `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET`. Google sign-in additionally requires both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; it is optional.
3. Generate a strong auth secret with `openssl rand -base64 32`; retain it in the deployment secret manager. It signs sessions and encrypts OAuth tokens. Never commit it or give it a `NEXT_PUBLIC_` prefix.
4. Create a Google OAuth **Web application** client. Register the exact authorized callback `<BETTER_AUTH_URL>/api/auth/callback/google`, for example `http://localhost:3000/api/auth/callback/google` for `pnpm dev`. Configure production callbacks separately and use HTTPS.
5. Visit `/auth`, sign in with Google and confirm that `/account` shows your own profile. Sign out and verify that `/account` redirects to `/auth` and `/api/me` returns HTTP 401.

`BETTER_AUTH_URL` is one exact origin, with no path, credentials, query or fragment. HTTP is accepted only on loopback hosts outside production. Origins are not inferred from request headers and no wildcard origin is trusted. A missing required variable disables sign-in: the UI explains that setup is incomplete, auth endpoints return 503 and protected account reads remain anonymous. A complete but invalid configuration throws a sanitized error. Builds and synthetic previews do not need a database or Google secrets because auth/database initialization is lazy.

## Identity and schema

- Better Auth's user ID **is** `app_users.id`; UUID primary keys and all existing references are preserved. There is no second application-user table or email-based lookup that grants ownership.
- `display_name` is the mapped auth name. Migration 0003 converts existing null display names to an empty string, preserving “not provided” without copying private email addresses into names. It adds email verification, optional image and update timestamp fields.
- `auth_accounts` maps the stable `(provider_id, account_id)` pair to one local user, independently of their current email. The provider pair is unique. OAuth tokens are encrypted by Better Auth before storage.
- Account linking, including implicit same-email linking, is disabled. Pre-existing placeholder `app_users` with a matching email do not automatically become accessible Google identities. A future verified migration/linking procedure must handle those accounts; do not link them by email alone.
- `auth_sessions` contains opaque, signed-cookie session references, expiration and optional client metadata. Sessions and provider accounts are deleted when their user is deleted.
- `auth_verifications` stores temporary OAuth state/verification data, including expiry. The library verifies OAuth state and handles expiration checks; do not reimplement OAuth/PKCE or cookie signing in application code.

## Server boundaries

- `/api/auth/[...all]` delegates GET/POST directly to the auth library, preserving its cookie/security headers. Email/password login is enabled; self-service account deletion remains disabled. `/reset-password` accepts the library-issued recovery token and submits the replacement password through Better Auth.
- `getCurrentUser(headers)` verifies the session through Better Auth and returns only `{ id, email, name }`. It does not trust a user ID from headers, query strings or local storage. Database failures propagate; they do not grant access.
- `requireCurrentUser()` protects server pages with a redirect for anonymous users. `/account` uses this guard; `/api/me` returns the current identity or an uncached 401. It accepts no target-user ID and sends `Cache-Control: private, no-store` with `Vary: Cookie`.
- Session cookies use the library's HttpOnly/SameSite defaults and Secure cookies on HTTPS. Database sessions last seven days with the library's one-day refresh interval. Cookie session caching is disabled, so deleted/revoked sessions cannot continue authenticating through a cached cookie payload.
- Origin/CSRF checks are explicitly enabled in every environment, including tests (the library otherwise skips origin checks under test mode). Only the configured origin is trusted. Built-in rate limiting is enabled; its default in-process storage must be revisited before running multiple application instances.
- Client sign-in uses validated same-origin success/error destinations, allowing only `/join` or `/join/<64 lowercase hex>` as invitation return paths. Errors shown to users are localized and do not expose provider/database details. Loading buttons prevent duplicate operations.

## Deliberate access boundary

Logging in creates an identity, **not** project membership, household association or a staff role. Authentication does not infer `people`/`household_members` links, approve join requests or authorize resident records by itself. The live directory uses explicit links and server authorization described in [resident authorization](resident-authorization.md). The management workspace uses separately authorized structural reads described in [management workspace](management-workspace.md). Invitation joining requires separate manager approval; see [invitation onboarding](invitation-onboarding.md). Household profiles and private family management now use separately authorized live endpoints. Existing `/api/dev/*` routes remain development-only prototypes, not authorized production APIs.

Explicit user/person links and scoped directory authorization are implemented, and invitation approval can provision a link after manager verification. Do not use `households.created_by` as the sole proof of residency.

## Verification

Unit/component tests cover environment validation, session guards, anonymous API responses, profile minimization, unavailable sign-in, localized errors and duplicate-submit prevention. The PostgreSQL CI job applies all migrations and checks identity uniqueness, cascades, real signed-session lookup, invalid/expired/revoked sessions, OAuth state/origin checks and sign-out.

Google's external consent/token exchange requires real OAuth credentials and a configured callback and is a separate deployment smoke check. Synthetic tests do not claim to complete a real Google login. Screenshots remain opt-in through the manual workflow.

Official references: [Next.js integration](https://better-auth.com/docs/integrations/next), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [Google](https://better-auth.com/docs/authentication/google), [session management](https://better-auth.com/docs/concepts/session-management).

## Existing dependency audit findings

`pnpm audit --prod` currently reports two high and three moderate advisories in the existing `next → postcss@8.4.31` and Drizzle tooling/esbuild chains. The affected PostCSS/esbuild versions are unchanged from the main-branch lockfile; the new auth dependency brings the existing optional Drizzle tooling peer into the production audit graph. This PR does not claim a clean dependency audit. Address those upstream/tooling versions separately before production readiness.

Explicit resident links and directory read authorization are now described in [resident authorization](resident-authorization.md). Signing in alone still grants no resident or staff permissions.

Successful sign-in returns to `/directory`; `/account` remains available from the header for profile and sign-out. The directory explains missing resident access without offering an unimplemented self-claim flow.

A public pilot requires its own HTTPS origin, database and OAuth client. See [pilot environment](pilot-environment.md) for the physical-device acceptance flow and the distinct synthetic browser CI boundary.


## Email/password lifecycle

- `/auth` supports email/password login alongside the optional Google button. Passwords are 12–128 characters. The library owns hashing, comparison, CSRF/origin checks, cookies, verification and recovery tokens. Passwords and tokens are never logged by application code.
- Existing Google users: sign in with Google, open `/account`, and select **Set a password for email sign-in**. This adds a `credential` account to the same user UUID. The server action requires a verified email and requires a session created within the last five minutes and delegates to Better Auth’s `setPassword` API. It cannot replace an existing password. If the session is stale, sign out and sign in again first. This flow requires no email delivery setup and preserves existing memberships and roles.
- Users with a password can change it in `/account` by providing the current password. Other sessions are revoked on a successful change.
- For new email registrations and forgotten-password recovery, set **both** `RESEND_API_KEY` and `AUTH_EMAIL_FROM` in the target deployment and redeploy. `AUTH_EMAIL_FROM` must be a bare email address on a verified Resend sending domain, such as `auth@your-domain.example`. These are server-only secrets/configuration, never `NEXT_PUBLIC_` variables. Configure each environment independently.
- Registration and recovery controls are hidden until delivery is configured; the registration API is also disabled without delivery. Existing verified identities with passwords can still log in. Partial provider/delivery configuration fails closed.
- Registration sends a verification link and does not establish a session until the address is verified and the user signs in. Unverified email/password login is rejected; it resends verification when delivery is available. New identities do not receive project, resident or staff access. Verified email is still required for recipient-restricted invitations.
- Duplicate email registration returns the library’s generic response and never attaches a credential to an existing identity. Automatic linking by matching email remains disabled. Google users should set a password from their authenticated account rather than register again.
- Recovery uses a generic confirmation for existing and missing addresses. Tokens expire according to Better Auth’s one-hour default, are single-use, and resetting the password revokes existing sessions. The UI accepts tokens only as library credentials; it does not infer user identity from query parameters.
- Messages contain Hebrew/English text and a library-generated URL. Delivery failures produce generic errors. A deployment smoke check must verify actual inbox delivery, sender-domain authorization, callback origin, verification, recovery and a subsequent password login. Tests capture email links without delivering messages to real recipients.
- Built-in rate limiting retains the existing process-local storage limitation. Multi-instance deployments need shared rate-limit storage as documented above.
