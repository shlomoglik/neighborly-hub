import { databaseTarget, validateDatabaseConnection } from "./target.mjs";

export function validateStagingConnections(environment) {
  const target = databaseTarget(environment);
  if (target.schema !== "staging") return target;
  const runtime = validateDatabaseConnection(environment.DATABASE_URL, target, "runtime");
  const migration = validateDatabaseConnection(
    environment.MIGRATION_DATABASE_URL,
    target,
    "migration",
  );
  if (runtime.hostname !== migration.hostname || runtime.pathname !== migration.pathname) {
    throw new Error("Staging runtime and migrations must use the same database endpoint");
  }
  return target;
}

/** Query effective privileges, including PUBLIC grants and inherited membership.
 * Must run before any staging DDL. It never changes Production privileges.
 */
export async function assertStagingIsolation(tx, target) {
  const [identity] = await tx`select current_user as role`;
  if (identity.role !== target.migrationRole)
    throw new Error("Unexpected Staging migration identity");
  const roles = [target.runtimeRole, target.migrationRole];
  for (const role of roles) {
    const [result] = await tx`
      select exists (
        select 1 from pg_roles where rolname = ${role} and rolcanlogin
          and not (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)
      ) and not exists (
        select 1 from pg_roles where rolname <> ${role} and pg_has_role(${role}, oid, 'MEMBER')
      ) and not has_database_privilege(${role}, current_database(), 'CREATE')
      and not exists (
        select 1 from pg_namespace n
        where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
          and n.nspname not in (${target.schema}, ${target.history})
          and (n.nspowner = (select oid from pg_roles where rolname = ${role})
            or has_schema_privilege(${role}, n.oid, 'CREATE'))
      ) and not exists (
        select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
          and n.nspname not in (${target.schema}, ${target.history})
          and ((c.relkind in ('r','p','v','m','f') and
            has_table_privilege(${role}, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
            or (c.relkind = 'S' and has_sequence_privilege(${role}, c.oid, 'SELECT,UPDATE,USAGE')))
      ) and not exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
          and n.nspname not in (${target.schema}, ${target.history})
          and p.prosecdef and has_function_privilege(${role}, p.oid, 'EXECUTE')
      ) as isolated`;
    if (!result.isolated)
      throw new Error("Staging role isolation check failed; inspect effective database grants");
  }
  const [schemas] = await tx`
    select count(*)::int as count from pg_namespace n
    where n.nspname in (${target.schema}, ${target.history})
      and n.nspowner = (select oid from pg_roles where rolname = ${target.migrationRole})`;
  if (schemas.count !== 2)
    throw new Error("Staging schemas must be provisioned with the migration owner");
  const [runtime] = await tx`select
    has_schema_privilege(${target.runtimeRole}, ${target.schema}, 'USAGE')
    and not has_schema_privilege(${target.runtimeRole}, ${target.schema}, 'CREATE')
    and not has_schema_privilege(${target.runtimeRole}, ${target.history}, 'USAGE,CREATE')
    as restricted`;
  if (!runtime.restricted) throw new Error("Staging runtime schema privileges are invalid");
}

export async function restrictStagingObjects(tx, target) {
  // Existing migrations are immutable. Pin their invoker functions so deferred
  // triggers never depend on a pooled connection's search_path.
  const functions = await tx`
    select p.oid::regprocedure::text as signature from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace where n.nspname = ${target.schema}`;
  for (const fn of functions) {
    // regprocedure comes from the catalog and is quoted/formatted by PostgreSQL.
    await tx.unsafe(`alter function ${fn.signature} set search_path = staging, pg_catalog`);
  }
  await tx`revoke all on all tables in schema staging from public`;
  await tx`revoke all on all sequences in schema staging from public`;
  await tx`revoke all on all functions in schema staging from public`;
  await tx`grant select, insert, update, delete on all tables in schema staging to neighborly_staging_app`;
  await tx`grant usage, select on all sequences in schema staging to neighborly_staging_app`;
  await tx`grant execute on all functions in schema staging to neighborly_staging_app`;
}
