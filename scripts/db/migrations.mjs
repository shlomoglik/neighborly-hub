import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";
import { databaseTarget, validateDatabaseConnection } from "./target.mjs";
import {
  assertStagingIsolation,
  restrictStagingObjects,
  validateStagingConnections,
} from "./staging-isolation.mjs";

export class MigrationError extends Error {}

export const migrationsDirectory = new URL("../../database/migrations/", import.meta.url);

// Ignore quoted SQL, function bodies and comments when inspecting transaction boundaries.
function controlStatements(sql) {
  const unquoted = sql.replace(
    /\$(\w*)\$[\s\S]*?\$\1\$|'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\//g,
    " ",
  );
  return unquoted
    .split(";")
    .some((statement) =>
      /^(?:BEGIN|START\s+TRANSACTION|COMMIT|END|ROLLBACK|ABORT|PREPARE\s+TRANSACTION)\b/i.test(
        statement.trim(),
      ),
    );
}

export function migrationBody(source) {
  const opening = /^(?:\s|--[^\n]*(?:\n|$))*BEGIN\s*;/i;
  const body = source.replace(opening, "").replace(/COMMIT\s*;\s*$/i, "");
  if (!opening.test(source) || !/COMMIT\s*;\s*$/i.test(source) || controlStatements(body)) {
    throw new MigrationError(
      "Migrations must contain one outer BEGIN/COMMIT and no nested transaction control",
    );
  }
  return body;
}

export async function loadMigrations(directory = migrationsDirectory) {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  if (!names.length || names.some((name) => !/^\d{4}_[a-z0-9_]+\.sql$/.test(name))) {
    throw new MigrationError("Invalid migration filenames");
  }
  if (new Set(names.map((name) => name.slice(0, 4))).size !== names.length) {
    throw new MigrationError("Migration numbers must be unique");
  }
  return Promise.all(
    names.map(async (name) => {
      const source = await readFile(new URL(name, directory), "utf8");
      return {
        name,
        checksum: createHash("sha256").update(source).digest("hex"),
        body: migrationBody(source),
      };
    }),
  );
}

export function migrationPlan(migrations, history) {
  for (const [index, row] of history.entries()) {
    if (migrations[index]?.name !== row.name || migrations[index].checksum !== row.checksum) {
      throw new MigrationError(
        "Migration history differs from this release; do not edit or remove applied files",
      );
    }
  }
  return migrations.slice(history.length);
}

/**
 * One transaction owns the lock, DDL and history, including rollback on any failure.
 * @param {*} sql
 * @param {*} migrations
 * @param {{ baselineThrough?: string, onProgress?: (step: string) => void, target?: ReturnType<typeof databaseTarget> }} options
 */
export async function runMigrations(
  sql,
  migrations,
  { baselineThrough, onProgress = () => {}, target = databaseTarget({}) } = {},
) {
  if (target.schema === "staging" && baselineThrough)
    throw new MigrationError(
      "Staging must be initialized from authoritative migrations, not baselined",
    );
  onProgress("connect-and-begin");
  return sql.begin(async (tx) => {
    onProgress("lock");
    await tx`set local lock_timeout = '10s'`;
    await tx`set local statement_timeout = '5min'`;
    await tx`select set_config('search_path', ${target.schema + ", pg_catalog"}, true)`;
    if (target.schema === "staging") await assertStagingIsolation(tx, target);
    await tx`select pg_advisory_xact_lock(78234619, 1)`;
    onProgress("history");
    const [existing] = await tx`select to_regclass(${target.history + ".history"}) as history`;
    const [schema] = await tx`select exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = ${target.schema} and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
    ) as populated`;
    if (!existing.history && schema.populated && !baselineThrough) {
      throw new MigrationError(
        "Existing database has no migration history; explicit verified baselining is required",
      );
    }
    if (baselineThrough && (existing.history || !schema.populated)) {
      throw new MigrationError(
        "Baseline requires an existing populated database without migration history",
      );
    }
    const baselineIndex = baselineThrough
      ? migrations.findIndex((m) => m.name === baselineThrough)
      : -1;
    if (baselineThrough && baselineIndex < 0)
      throw new MigrationError("Unknown baseline migration");
    if (target.schema === "public") await tx`create schema if not exists neighborly_migrations`;
    await tx`revoke all on schema ${tx(target.history)} from public`;
    await tx`create table if not exists ${tx(target.history)}.history (
      name text primary key, checksum text not null, applied_at timestamptz not null default now(),
      baselined boolean not null default false
    )`;
    await tx`revoke all on ${tx(target.history)}.history from public`;
    const history =
      await tx`select name, checksum from ${tx(target.history)}.history order by name`;
    const pending = migrationPlan(migrations, history);
    const selected = baselineThrough ? migrations.slice(0, baselineIndex + 1) : pending;
    for (const migration of selected) {
      onProgress(`${baselineThrough ? "baseline" : "apply"}:${migration.name}`);
      if (!baselineThrough) await tx.unsafe(migration.body);
      await tx`insert into ${tx(target.history)}.history (name, checksum, baselined)
        values (${migration.name}, ${migration.checksum}, ${!!baselineThrough})`;
    }
    if (target.schema === "staging") await restrictStagingObjects(tx, target);
    onProgress("commit");
    return {
      applied: baselineThrough ? 0 : selected.length,
      baselined: baselineThrough ? selected.length : 0,
    };
  });
}

/** @param {Record<string, string | undefined>} environment */
export function migrationConnection(environment = process.env) {
  const url = environment.MIGRATION_DATABASE_URL;
  if (!url)
    throw new MigrationError(
      "MIGRATION_DATABASE_URL is required (direct or session-mode PostgreSQL connection)",
    );
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol))
    throw new MigrationError("Invalid migration connection protocol");
  const target = databaseTarget(environment);
  validateDatabaseConnection(url, target, "migration");
  return url;
}

/** @param {{ environment?: Record<string, string | undefined>, baselineThrough?: string, onProgress?: (step: string) => void }} options */
export async function migrate({
  environment = process.env,
  baselineThrough,
  onProgress = () => {},
} = {}) {
  onProgress("configuration");
  const connection = migrationConnection(environment);
  const target = validateStagingConnections(environment);
  onProgress("load-files");
  const migrations = await loadMigrations();
  onProgress("create-client");
  const sql = postgres(connection, {
    max: 1,
    prepare: false,
    connect_timeout: 15,
    onnotice: () => {},
  });
  try {
    return await runMigrations(sql, migrations, { baselineThrough, onProgress, target });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
