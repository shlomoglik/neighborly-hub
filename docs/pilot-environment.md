# Pilot environment and full browser journey

## What is ready and what requires a connection

The pilot browser CI job runs the actual production Next.js application over isolated loopback HTTPS with a fresh PostgreSQL 16 database. It exercises desktop and 390px mobile layouts with synthetic identities and real signed database sessions. The application itself retains normal Better Auth verification; there is no test login route, header bypass, password provider or production test plugin.

This does **not** deploy a publicly reachable pilot or complete real Google consent. A phone-accessible pilot still needs a connected hosting account, a separate PostgreSQL database and a real Google OAuth Web client. None of those credentials are stored in this repository. A successful CI run must not be presented as a deployed URL or a successful Google account login.

## Public pilot activation

Use a separate Vercel project/environment and a separate PostgreSQL database (a dedicated Supabase PostgreSQL project is also suitable; do not use Supabase Auth or the historical Supabase schema). Keep this pilot separate from production data and credentials.

1. Import the GitHub repository into the chosen hosting project. Use Node 24, pnpm 10.18.3, install `pnpm install --frozen-lockfile`, and build `pnpm build`. Select the reviewed commit; never deploy an unrelated working branch implicitly.
2. Provision an empty pilot database. Apply every file in `database/migrations/` in lexical order with `psql -v ON_ERROR_STOP=1 -f <file>`. These migrations are authoritative and are **not** repeatable; do not rerun the baseline against an already initialized database. Run the SQL checks in `database/tests/` afterward. Database initialization is separate from application startup and is never run automatically in request handlers.
3. Set server-only `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` in the hosting secret manager. Generate an independent secret, e.g. `openssl rand -base64 32`. `BETTER_AUTH_URL` must be the exact stable public HTTPS origin, without a path. Avoid changing preview hostnames for this test.
4. Register the exact Google callback `<BETTER_AUTH_URL>/api/auth/callback/google` for that OAuth Web client. Complete the Google console setup for the accounts participating in the pilot. Do not reuse the synthetic CI credentials below.
5. Deploy and sign in once as the intended pilot administrator. An identity is created, but signing in grants no project, resident or administrative role.
6. A trusted operator verifies that existing account and provisions its role by **UUID**, independently of email matching:

   ```sql
   -- Replace the UUID only after verifying the intended signed-in account.
   INSERT INTO global_roles (user_id, role)
   SELECT id, 'admin' FROM app_users
   WHERE id = 'verified-existing-account-uuid'::uuid
   ON CONFLICT DO NOTHING;
   ```

7. Test the real flow below from desktop and a physical phone. No real family/contact data is required for the pilot; use consenting test participants and fictional names.

The app currently enforces HTTP only on loopback outside production. Do not make a development server or its `/api/dev/*` routes publicly reachable to test a phone. Public pilot hosting must run the production build over HTTPS.

## Physical-device acceptance flow

| Step                                                | Actor                            | Expected behavior                                                                    |
| --------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| Open an invitation while signed out                 | Resident, phone                  | Google sign-in preserves the invitation return path                                  |
| Sign in with Google                                 | Each test participant            | Own profile shown; no roles inferred from email/name                                 |
| Create one project, one building and two apartments | Verified global admin, desktop   | Wizard persists the hierarchy and opens its management view                          |
| Issue an apartment invitation                       | Admin                            | QR is local; copy, print/download, WhatsApp and mailto open prepared actions         |
| Share and open the link                             | Resident, phone                  | Correct project/building/apartment; viewing does not consume it                      |
| Submit a join request                               | Resident                         | Pending status; no directory access before approval                                  |
| Verify and approve the request                      | Manager/admin                    | One active household and linked adult representative                                 |
| Add a project-visible phone/email                   | Resident                         | Saved in own contacts; visible only according to directory policy                    |
| Add a child on Manage family members                | Representative                   | Child visible only on the private family page, never in directory/ordinary profile   |
| Invite an adult into that household                 | Representative → another account | Name-only request; no replacement household or representative role                   |
| Verify and approve the adult request                | Manager/admin                    | Same household, independent global identity, prior project memberships preserved     |
| Search and open household details                   | Approved resident                | Current-project name search works; cross-project global search is a separate feature |
| Try an unlinked account                             | Outsider                         | Cannot read household/private children or manage projects                            |
| Sign out and revisit a protected page               | Each participant                 | Redirect to sign-in; `/api/me` returns 401                                           |

Google consent, physical-device cookie behavior, WhatsApp client delivery, mail-client delivery and actual QR scanning must be recorded as device checks. A prepared share URL is not proof a message was sent. Screenshots remain on demand.

## Local pilot database on a Mac

Requires Docker Compose, Node 24 and pnpm 10.18.3. `compose.pilot.yml` exposes PostgreSQL only on `127.0.0.1:55432` and keeps a dedicated `neighborly-pilot` volume. It initializes the authoritative migrations only on an **empty** volume. It never loads real residents, OAuth credentials or synthetic administrative users.

1. Copy `.env.pilot.example` to `.env.pilot.local`. Set `PILOT_DB_PASSWORD` to a newly generated local-only value, for example `openssl rand -hex 24`.
2. Run `pnpm pilot:db`.
3. Configure `.env.local` using `.env.example`, with `DATABASE_URL=postgresql://neighborly:<local-password>@127.0.0.1:55432/neighborly_pilot`, `BETTER_AUTH_URL=http://localhost:3000`, an independent auth secret and real local Google OAuth settings. Both local files are ignored by Git. Never overwrite an existing `.env.local` containing another environment's settings.
4. Start `pnpm dev --hostname 127.0.0.1`; use the localhost OAuth callback described in [authentication](authentication.md). Provision an actual verified administrator UUID as above.
5. Stop with `docker compose --env-file .env.pilot.local -f compose.pilot.yml stop`. Keep the volume if retaining the pilot. New migrations must be applied explicitly to an existing volume; startup does not rerun them.

No reset/delete-volume command runs automatically. A local loopback address is not reachable from a physical phone; use the separate public HTTPS pilot for device checks.

## Automated browser coverage and result

The existing Next.js CI workflow includes a `Pilot browser journey` job using its own PostgreSQL service/database, dummy OAuth configuration and a temporary self-signed loopback certificate. It installs the already-established isolated Playwright tooling in the runner's temporary directory, without changing application dependencies. A minimal HTTPS bridge forwards to the normal production app bound to loopback.

`pilot-fixture.integration.test.ts` is a separate Vitest process. Its guard requires the exact loopback `neighborly_pilot` database, matching app database, synthetic OAuth values, a CI-only secret prefix and the loopback HTTPS origin. It also refuses a database that already contains users. It writes short-lived signed fixture cookies to a private runner directory, never to application routes or browser local storage. The fixture plugin is not imported by the Next.js runtime. CI's isolated database is discarded with the job; fixtures never target a connected/live database.

`scripts/pilot/browser-smoke.mjs` drives the real UI: project wizard, invitation/QR/share generation, pending join, approval, contact privacy, private child creation, existing-household adult join and current-project search/detail navigation. It also checks anonymous access, disabled production dev routes, outsider denial, exact-Origin writes, Google authorization URL/callback generation and browser runtime errors. Secure cookies and production HTTP/CSRF boundaries remain active. Only the local self-signed certificate is ignored by the browser.

CI uploads `pilot-smoke-result/pilot-smoke.json`, containing check names/pass status and the explicit real-Google-consent limitation. It uploads no browser storage state, invitation tokens, session cookies, database URLs, app logs, TLS keys or screenshots. A partial report has `passed: false`; inspect the failing job before declaring readiness.
