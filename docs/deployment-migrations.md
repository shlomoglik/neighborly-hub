# Deployment migrations

Vercel Git deployments use the committed `vercel.json` build command. `scripts/vercel-build.mjs` checks Vercel's system environment, builds the app, then runs pending SQL migrations **for Production and the explicitly configured `staging` Preview branch**. A failed build never migrates; a failed migration exits unsuccessfully, so Vercel does not publish that build. Ordinary `pnpm build`, PR CI builds, unrelated Preview and Development builds never migrate the live database. No new service or runtime migration hook is involved.

Enable automatically exposed Vercel system variables (`VERCEL` and `VERCEL_ENV`). Keep the Production Branch set to protected `main`, require PR checks, and verify no external deployment process bypasses this committed build command. Promoting an already built artifact or rolling back without a build does **not** run this gate: promote only an artifact whose migration gate completed for the same database. A rollback must remain compatible with the current schema.

## One-time activation before merging

This repository's live database was initialized manually and currently has migrations 0001–0007 applied. It has no history owned by this runner. **Do not rerun the SQL baseline on it.** Reconfirm its current state before adoption; this document is not evidence that another database has those migrations.

1. Set server-only `MIGRATION_DATABASE_URL` in **Vercel Production only**, using a direct or session-mode PostgreSQL connection to the **same database** as runtime `DATABASE_URL`. The migration role needs DDL rights on `public` and ownership/creation rights for `neighborly_migrations`. Never use transaction pooling, browser-visible variables or paste credentials into issue/PR bodies. Configure credentials in the provider's secret UI. Preview must use an isolated database for any live-data testing and must never inherit production credentials.
2. From the reviewed release checkout, verify the existing schema against migrations 0001–0007, including authentication, identity links, invitation/family constraints, subtype functions/triggers and the nullable `buildings.address` column/check constraint. Check your deployment/migration records and a schema-only dump; checking table names alone is insufficient. Back up the database before adoption. Baselining is an explicit operator assertion of that verification, not automatic schema inference.
3. In a trusted shell with the migration connection already injected by your secret manager, record the verified prefix once:

   ```bash
   pnpm db:migrate --baseline-through=0007_building_addresses.sql --acknowledge-existing-schema
   pnpm db:migrate
   ```

   The first command records checksums without replaying migration SQL or changing application rows. It refuses an empty database, unknown filenames or an existing history table. The second command should report zero migrations applied. If a database is only verified through an earlier file, baseline **that exact prefix**; the second command applies the remaining files. Never claim a migration is applied to bypass a failure.

4. Merge only after CI passes and the connection and baseline are ready. A Production deployment with missing credentials or a populated database without history deliberately fails closed. This PR itself does not alter hosted settings, baseline Production or publish a new version.

An empty database needs no baseline: `pnpm db:migrate` creates the authoritative schema and history together. The CLI does not implicitly load `.env` files; inject `MIGRATION_DATABASE_URL` explicitly (for example, through your secret manager). `DATABASE_URL` is never used as a fallback.

## History, locking and failures

Only `database/migrations/*.sql` is loaded, in filename order. Legacy `drizzle/migrations` is never read. Each file must have one outer `BEGIN;` / `COMMIT;`; the runner removes that wrapper and owns the transaction. Existing applied SQL files are immutable: SHA-256 hashes are recorded in `neighborly_migrations.history`. New files must have unique, increasing four-digit numbers. Changed, missing, reordered or unknown applied files block the release, including an older checkout that lacks a recorded migration.

A transaction-scoped PostgreSQL advisory lock serializes runners before checking/creating history. The lock, all pending DDL and all history rows share one transaction; any failure rolls the whole batch back. Lock acquisition/DDL lock waits are bounded at 10 seconds; each statement is bounded at five minutes and connection establishment at 15 seconds. Retry a deployment after investigating the failure; no successful migration is replayed. History lives in a dedicated schema with no `PUBLIC` privileges and must not be exposed by a data API.

Use additive, backward-compatible migrations: the previous version continues serving while the new build migrates, and a later publication failure cannot safely undo a committed schema change. Renames, drops, expensive backfills and nontransactional commands such as `CREATE INDEX CONCURRENTLY` require a separately planned rollout. Application rollback does not roll the database back. Restoring or manually editing history is not an automatic recovery mechanism.

CLI/build failures do not print connection strings, raw driver errors, SQL, parameters or row values. Static validation failures explain configuration/history problems; Deployment failures report the failing stage (configuration, build or migration), a validated SQLSTATE or known connection error code, and a fixed diagnostic hint when available. Unknown codes are reported as unavailable. SQLSTATE codes are also available from the manual CLI. Use the database provider's protected logs for detailed diagnostics.

## Verification

Unit tests cover transaction wrapper handling, immutable history, Production/Preview isolation, configuration failure, and build-before-migrate failure propagation. The database CI job uses disposable PostgreSQL databases to test fresh initialization, idempotency, atomic rollback/retry, adoption, checksum drift, older releases and concurrent runners, then applies the same runner to the integration database. The pilot browser CI job also initializes its isolated database through this runner. No test needs production secrets.

Official platform references: [conditional build commands](https://vercel.com/kb/guide/dynamic-build-commands), [system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables), [environment scoping](https://vercel.com/docs/environment-variables).

### Diagnosing a failed deployment

Production logs report migration checkpoints: configuration, load-files, create-client, connect-and-begin, lock, history, each apply:<filename>, and commit. A checkpoint records an attempted operation, not success; apply messages do not mean a transaction committed. All pending migrations remain atomic. The failure line includes the last checkpoint, an allowlisted connection/filesystem code or validated SQLSTATE (including nested causes and AggregateError), and a fixed error kind. Unknown errors never print arbitrary messages or stacks.

Pending migrations are expected and run automatically after history validation. Do not infer that missing migration history requires a baseline merely from a failed build. Verify the exact failure and existing schema first.

## Staging rollout

The exact `staging` Preview branch now has its own schema/role validation and post-build migration gate. See [Staging rollout](staging-rollout.md) for provisioning, exact branch variable scopes, runtime/migration isolation and live activation checks. Other previews remain migration-free.
