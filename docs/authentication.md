# Authentication foundation

Better Auth 1.7.10 manages Google OAuth and database-backed sessions. The Drizzle adapter uses the existing PostgreSQL database; Drizzle ORM is pinned to 0.45.2 to meet the adapter's peer requirement. No hosted auth service, password login, email delivery or SMS provider is introduced.

## Configure

1. Apply SQL migrations `0001_initial.sql`, `0002_party_subtype_integrity.sql` and `0003_auth_sessions.sql` in order. SQL migrations remain authoritative; do not run the legacy Supabase migrations, `drizzle-kit push` or the Better Auth migration CLI against this database.
2. Set the five server-only variables in `.env.example`: `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
3. Generate a strong auth secret with `openssl rand -base64 32`; retain it in the deployment secret manager. It signs sessions and encrypts OAuth tokens. Never commit it or give it a `NEXT_PUBLIC_` prefix.
4. Create a Google OAuth **Web application** client. Register the exact authorized callback `<BETTER_AUTH_URL>/api/auth/callback/google`, for example `http://localhost:3000/api/auth/callback/google` for `pnpm dev`. Configure production callbacks separately and use HTTPS.
5. Visit `/auth`, sign in with Google and confirm that `/account` shows your own profile. Sign out and verify that `/account` redirects to `/auth` and `/api/me` returns HTTP 401.

`BETTER_AUTH_URL` is one exact origin, with no path, credentials, query or fragment. HTTP is accepted only on loopback hosts outside production. Origins are not inferred from request headers and no wildcard origin is trusted. A missing variable disables sign-in: the UI explains that setup is incomplete, auth endpoints return 503 and protected account reads remain anonymous. A complete but invalid configuration throws a sanitized error. Builds and synthetic previews do not need a database or Google secrets because auth/database initialization is lazy.

## Identity and schema

- Better Auth's user ID **is** `app_users.id`; UUID primary keys and all existing references are preserved. There is no second application-user table or email-based lookup that grants ownership.
- `display_name` is the mapped auth name. Migration 0003 converts existing null display names to an empty string, preserving “not provided” without copying private email addresses into names. It adds email verification, optional image and update timestamp fields.
- `auth_accounts` maps the stable `(provider_id, account_id)` pair to one local user, independently of their current email. The provider pair is unique. OAuth tokens are encrypted by Better Auth before storage.
- Account linking, including implicit same-email linking, is disabled. Pre-existing placeholder `app_users` with a matching email do not automatically become accessible Google identities. A future verified migration/linking procedure must handle those accounts; do not link them by email alone.
- `auth_sessions` contains opaque, signed-cookie session references, expiration and optional client metadata. Sessions and provider accounts are deleted when their user is deleted.
- `auth_verifications` stores temporary OAuth state/verification data, including expiry. The library verifies OAuth state and handles expiration checks; do not reimplement OAuth/PKCE or cookie signing in application code.

## Server boundaries

- `/api/auth/[...all]` delegates GET/POST directly to the auth library, preserving its cookie/security headers. Email/password login and self-service account deletion are disabled. `/reset-password` redirects to the Google sign-in page.
- `getCurrentUser(headers)` verifies the session through Better Auth and returns only `{ id, email, name }`. It does not trust a user ID from headers, query strings or local storage. Database failures propagate; they do not grant access.
- `requireCurrentUser()` protects server pages with a redirect for anonymous users. `/account` uses this guard; `/api/me` returns the current identity or an uncached 401. It accepts no target-user ID and sends `Cache-Control: private, no-store` with `Vary: Cookie`.
- Session cookies use the library's HttpOnly/SameSite defaults and Secure cookies on HTTPS. Database sessions last seven days with the library's one-day refresh interval. Cookie session caching is disabled, so deleted/revoked sessions cannot continue authenticating through a cached cookie payload.
- Origin/CSRF checks are explicitly enabled in every environment, including tests (the library otherwise skips origin checks under test mode). Only the configured origin is trusted. Built-in rate limiting is enabled; its default in-process storage must be revisited before running multiple application instances.
- Client sign-in uses fixed same-origin success/error destinations. Errors shown to users are localized and do not expose provider/database details. Loading buttons prevent duplicate operations.

## Deliberate access boundary

Logging in creates an identity, **not** project membership, household association or a staff role. Authentication does not infer `people`/`household_members` links, approve join requests or authorize resident records by itself. The live directory uses explicit links and server authorization described in [resident authorization](resident-authorization.md). The management workspace uses separately authorized structural reads described in [management workspace](management-workspace.md). Household details and joining remain synthetic previews. Existing `/api/dev/*` routes remain development-only prototypes, not authorized production APIs.

The next PR must implement explicit user/person/membership links, project/building/approval checks and contact visibility filtering on the server before connecting resident data. Do not use `households.created_by` as the sole proof of residency.

## Verification

Unit/component tests cover environment validation, session guards, anonymous API responses, profile minimization, unavailable sign-in, localized errors and duplicate-submit prevention. The PostgreSQL CI job applies all migrations and checks identity uniqueness, cascades, real signed-session lookup, invalid/expired/revoked sessions, OAuth state/origin checks and sign-out.

Google's external consent/token exchange requires real OAuth credentials and a configured callback and is a separate deployment smoke check. Synthetic tests do not claim to complete a real Google login. Screenshots remain opt-in through the manual workflow.

Official references: [Next.js integration](https://better-auth.com/docs/integrations/next), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [Google](https://better-auth.com/docs/authentication/google), [session management](https://better-auth.com/docs/concepts/session-management).

## Existing dependency audit findings

`pnpm audit --prod` currently reports two high and three moderate advisories in the existing `next → postcss@8.4.31` and Drizzle tooling/esbuild chains. The affected PostCSS/esbuild versions are unchanged from the main-branch lockfile; the new auth dependency brings the existing optional Drizzle tooling peer into the production audit graph. This PR does not claim a clean dependency audit. Address those upstream/tooling versions separately before production readiness.

Explicit resident links and directory read authorization are now described in [resident authorization](resident-authorization.md). Signing in alone still grants no resident or staff permissions.

Successful Google sign-in now returns to `/directory`; `/account` remains available from the header for profile and sign-out. The directory explains missing resident access without offering an unimplemented self-claim flow.
