# Authentication foundation

Better Auth 1.7.10 manages Google OAuth and database-backed sessions. The Drizzle adapter uses the existing PostgreSQL database; Drizzle ORM is pinned to 0.45.4 to meet the adapter's peer requirement. Email/password authentication shares the same identity and sessions; optional Resend delivery supports verification and password recovery. No additional runtime dependency or database migration is required.

## Configure

1. Apply SQL migrations `0001_initial.sql`, `0002_party_subtype_integrity.sql` and `0003_auth_sessions.sql` in order. SQL migrations remain authoritative; do not run the legacy Supabase migrations, `drizzle-kit push` or the Better Auth migration CLI against this database.
2. Set the three required server-only variables in `.env.example`: `DATABASE_URL`, `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET`. Set both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to also enable Google.
3. Generate a strong auth secret with `openssl rand -base64 32`; retain it in the deployment secret manager. It signs sessions and encrypts OAuth tokens. Never commit it or give it a `NEXT_PUBLIC_` prefix.
4. Create a Google OAuth **Web application** client. Register the exact authorized callback `<BETTER_AUTH_URL>/api/auth/callback/google`, for example `http://localhost:3000/api/auth/callback/google` for `pnpm dev`. Configure production callbacks separately and use HTTPS.
5. Visit `/auth`, sign in with Google and confirm that `/account` shows your own profile. Sign out and verify that `/account` redirects to `/auth` and `/api/me` returns HTTP 401.

`BETTER_AUTH_URL` is one exact origin, with no path, credentials, query or fragment. HTTP is accepted only on loopback hosts outside production. Origins are not inferred from request headers and no wildcard origin is trusted. A missing required variable disables sign-in: the UI explains that setup is incomplete, auth endpoints return 503 and protected account reads remain anonymous. A complete but invalid configuration throws a sanitized error. Builds and synthetic previews do not need a database or Google secrets because auth/database initialization is lazy.

## Identity and schema

- Better Auth's user ID **is** `app_users.id`; UUID primary keys and all existing references are preserved. There is no second application-user table or email-based lookup that grants ownership.
- `display_name` is the mapped auth name. Migration 0003 converts existing null display names to an empty string, preserving “not provided” without copying private email addresses into names. It adds email verification, optional image and update timestamp fields.
- `auth_accounts` maps the stable `(provider_id, account_id)` pair to one local user, independently of their current email. The provider pair is unique. OAuth tokens are encrypted by Better Auth before storage.
- Implicit same-email linking is disabled. Explicit Google linking from an authenticated account is enabled only for matching verified emails; placeholder identities never become accessible merely by matching an OAuth email.
- `auth_sessions` contains opaque, signed-cookie session references, expiration and optional client metadata. Sessions and provider accounts are deleted when their user is deleted.
- `auth_verifications` stores temporary OAuth state/verification data, including expiry. The library verifies OAuth state and handles expiration checks; do not reimplement OAuth/PKCE or cookie signing in application code.

## Server boundaries

- `/api/auth/[...all]` delegates GET/POST directly to the auth library, preserving its cookie/security headers. Verified email/password login is enabled; self-service account deletion remains disabled. `/reset-password` accepts recovery tokens issued by Better Auth.
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

Successful Google sign-in now returns to `/directory`; `/account` remains available from the header for profile and sign-out. The directory explains missing resident access without offering an unimplemented self-claim flow.

A public pilot requires its own HTTPS origin, database and OAuth client. See [pilot environment](pilot-environment.md) for the physical-device acceptance flow and the distinct synthetic browser CI boundary.

## Email and password

- `/auth` offers email/password sign-in alongside Google when configured. Failed credentials show a generic localized error. Invitation return paths retain the existing allowlist.
- Existing Google users: sign in with Google, open `/account`, and **Set a password**. This invokes Better Auth's server-only `setPassword` through a session-protected Server Action. A verified email and a session created within the last five minutes are required. It adds a credential account to the same user ID, without changing memberships or roles, and cannot overwrite an existing password. Signing out and back in with Google refreshes an old session.
- Existing password users can change their password on `/account` by supplying their current password. Other sessions are revoked. Passwords must have 12–128 characters and are hashed by Better Auth's built-in scrypt implementation; plaintext passwords are never stored.
- New registrations require **both** server-only `RESEND_API_KEY` and `AUTH_EMAIL_FROM` (bare email on a verified Resend sending domain). Registration remains disabled on the server and hidden in the UI without delivery configuration. Existing verified users can still set/use passwords without a mail provider. Google configuration is optional; partial Google/mail configuration is rejected.
- With delivery configured, registration sends a verification link. Unverified accounts cannot sign in. A verification link returns to `/auth`, retaining the invitation destination; the user then signs in with their password. A repeated unverified sign-in resends verification. Duplicate registration receives Better Auth's generic response and does not attach credentials to an existing identity.
- **Forgot password** sends a generic response regardless of whether an account exists. `/reset-password` consumes a single-use expiring token. Reset revokes existing sessions; it does not grant roles or bypass email verification. Provider errors, tokens and recovery links are never logged by the delivery helper. Mail text includes Hebrew and English.
- After deployment, verify a real delivered registration email, verification, login, recovery and token reuse rejection with a disposable account. Real email delivery requires the operator's sending-domain/API-key setup; automated tests capture email callbacks without sending mail.

References: [email/password](https://better-auth.com/docs/authentication/email-password), [email verification](https://better-auth.com/docs/concepts/email), [Resend email API](https://resend.com/docs/api-reference/emails/send-email).

## Link sign-in methods to one identity

- `/account` shows whether Google and email/password credentials are connected. Google users add a password using the existing verified, fresh-session Server Action; password users choose **Connect Google to this account** and complete Google OAuth. The page reloads its methods from server-owned account records.
- `/link-social` requires a verified local email and a session created within five minutes. This guard applies to direct API requests as well as the UI. Better Auth validates OAuth state, the provider response, and ownership of the Google account. Google must report a verified email matching the local account (case-insensitively). No provider bypasses verification via `trustedProviders`.
- `disableImplicitLinking` remains enabled. A Google sign-in for an existing email cannot silently attach credentials; the user signs in with the existing method (or recovers access through email) before explicitly linking. A Google account already owned by another user cannot be moved. Linking preserves the user UUID, memberships, roles and profile; there is no user-record merge operation.
- Unverified authenticated users can request verification from `/account` when mail delivery is configured, then sign in again. A stale-session or failed-link message instructs the user to sign in again and select a matching Google email. Callback error text is never rendered directly.
- Registration keeps Better Auth's enumeration-safe response for existing addresses and never creates another user or attaches a password to an existing Google account. The UI explains that existing users should sign in or reset their password, then add the other method in My account. The API and unique email constraint remain authoritative; there is no public email-existence endpoint.
- CI uses a mocked Google provider response to exercise real OAuth state, callback and database behavior. Actual Google consent and inbox delivery require a smoke test with a disposable account in the configured environment.
