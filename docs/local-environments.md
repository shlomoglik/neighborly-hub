# Local application environments

Run the Next.js app locally against one of four explicitly configured PostgreSQL targets.

## Setup

Use Node 24 and pnpm 10. Copy the appropriate `.env.<target>.example` file to `.env.<target>.local`, populate secrets, then run `pnpm dev:<target>`.

For a local database, the existing `compose.pilot.yml` supplies PostgreSQL 16 on 127.0.0.1:55432. Set `PILOT_DB_PASSWORD` in `.env.pilot.local` and run `pnpm pilot:db`. The local URL password must match that value. The compose volume is persistent; SQL migrations mounted under docker-entrypoint-initdb.d run only when the volume is first created. Use the existing migration workflow for subsequent schema updates.

The launcher forces `BETTER_AUTH_URL=http://localhost:3000`, regardless of target. Register `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI in the Google OAuth Web application. Production and staging deployed origins require their own callback URLs.

The launcher passes only the selected environment file to Next.js, overriding inherited values. Do not place conflicting credentials in `.env.local` or other automatically loaded Next.js dotenv files.

## Production safeguards

`pnpm dev:production` requires explicit `ALLOW_PRODUCTION_DEBUG=true` and `DATABASE_READ_ONLY=true`. **These flags do not enforce database permissions.** Use a separate PostgreSQL role granted SELECT only, with no write, schema modification, or role inheritance privileges. Never use a production migration connection string. Interactive Better Auth login/session writes may not work with a read-only role; production debugging is intentionally limited.

The separate `scripts/db/guard-nonproduction.mjs` is a reusable defense for future fixture commands; no seed/system-test workflow is introduced by this PR. Database host naming checks are only defense in depth, not proof that a remote database is non-production. Verify database identity and permissions before introducing remote writes.

Do not copy real resident data into local databases. Keep all `.env.*.local` files private.

## Administrator bootstrap

Sign in once using Google so the account exists and has a verified email. For a local database, run:

```sh
pnpm admin:grant --email you@example.com
```

This command is idempotent and adds a global `admin` role to an existing verified user. It never creates an account. For remote non-production environments, use `pnpm admin:grant:development --email ...` or `pnpm admin:grant:staging --email ...` and set `ALLOW_REMOTE_ADMIN_BOOTSTRAP=true` in the selected private environment file. There is intentionally no production command. A hostname check is not an authoritative environment identity check: verify that the selected remote database is genuinely non-production before opting in. Do not grant global admin to seed/test identities in production.

For the hosted Staging rollout and isolation prerequisites, see [Staging rollout](staging-rollout.md). The Staging launcher requires `DATABASE_SCHEMA=staging` and the dedicated runtime role; hosted provisioning remains a separate step.
