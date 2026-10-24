import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadMigrations, runMigrations } from "../../../scripts/db/migrations.mjs";
import { databaseTarget } from "../../../scripts/db/target.mjs";

// Requires a disposable CI cluster with CREATE DATABASE/ROLE, never hosted credentials.
const url = process.env.MIGRATION_TEST_DATABASE_URL;
describe.skipIf(!url)("Staging schema isolation using real login roles", () => {
  let admin: ReturnType<typeof postgres>;
  let owner: ReturnType<typeof postgres>;
  let migration: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  let database: string;
  const target = databaseTarget({ DATABASE_SCHEMA: "staging" });
  let migrations: Awaited<ReturnType<typeof loadMigrations>>;
  beforeAll(async () => {
    admin = postgres(url!, { max: 1, prepare: false, onnotice: () => {} });
    database = `staging_test_${randomUUID().replaceAll("-", "")}`;
    await admin`create database ${admin(database)}`;
    const connection = new URL(url!);
    connection.pathname = `/${database}`;
    owner = postgres(connection.href, { max: 1, prepare: false, onnotice: () => {} });
    await owner`create schema extensions`;
    await owner`create extension pg_stat_statements with schema extensions`;
    migrations = await loadMigrations();
    await runMigrations(owner, migrations);
    await owner`insert into public.projects (name) values ('Production sentinel')`;
    await owner.unsafe(
      await readFile(
        new URL("../../../database/operations/staging-roles.sql", import.meta.url),
        "utf8",
      ),
    );
    for (const role of [target.runtimeRole!, target.migrationRole!]) {
      // Disposable test credentials, never used by a hosted environment.
      await owner.unsafe(`alter role ${role} password 'ci_staging_only'`);
    }
    const login = (role: string) => {
      const next = new URL(connection);
      next.username = role;
      next.password = "ci_staging_only";
      return postgres(next.href, { max: 2, prepare: false, onnotice: () => {} });
    };
    migration = login(target.migrationRole!);
    runtime = login(target.runtimeRole!);
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    if (runtime) await runtime.end();
    if (migration) await migration.end();
    if (owner) await owner.end();
    if (database && admin) await admin`drop database if exists ${admin(database)} with (force)`;
    if (admin) {
      await admin`drop role if exists neighborly_staging_app, neighborly_staging_migrator`;
      await admin.end();
    }
  });
  it("initializes and repeats Staging migrations without changing Production history or data", async () => {
    expect(await runMigrations(migration, migrations, { target })).toEqual({
      applied: 8,
      baselined: 0,
    });
    expect(await runMigrations(migration, migrations, { target })).toEqual({
      applied: 0,
      baselined: 0,
    });
    const [snapshot] = await owner`select
      (select count(*)::int from public.projects where name = 'Production sentinel') as sentinel,
      (select count(*)::int from neighborly_migrations.history) as production,
      (select count(*)::int from neighborly_staging_migrations.history) as staging`;
    expect(snapshot).toEqual({ sentinel: 1, production: 8, staging: 8 });
    await expect(
      runMigrations(migration, migrations, { target, baselineThrough: migrations[0].name }),
    ).rejects.toThrow("not baselined");
  });
  it("denies both roles Production CRUD, DDL, history and role escalation", async () => {
    for (const client of [runtime, migration]) {
      for (const sql of [
        "select * from public.projects",
        "insert into public.projects(name) values ('Denied')",
        "update public.projects set name='Denied'",
        "delete from public.projects",
        "alter table public.projects add column denied text",
        "create table public.denied(id int)",
        "select * from neighborly_migrations.history",
        "delete from neighborly_migrations.history",
        "set role neighborly",
        "set role service_role",
      ])
        await expect(client.unsafe(sql)).rejects.toMatchObject({
          code: expect.stringMatching(/^(42501|22023)$/),
        });
    }
    await expect(runtime`create table staging.denied(id int)`).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      runtime`select * from neighborly_staging_migrations.history`,
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("fails the isolation gate for PUBLIC and inherited grants and privileged functions", async () => {
    await owner`grant pg_read_all_stats to neighborly_staging_app`;
    await expect(runMigrations(migration, migrations, { target })).rejects.toThrow(
      "isolation check failed",
    );
    await owner`revoke pg_read_all_stats from neighborly_staging_app`;
    await owner`grant select on public.projects to public`;
    await expect(runMigrations(migration, migrations, { target })).rejects.toThrow(
      "isolation check failed",
    );
    await owner`revoke select on public.projects from public`;
    await owner`grant neighborly_staging_migrator to neighborly_staging_app`;
    await expect(runMigrations(migration, migrations, { target })).rejects.toThrow(
      "isolation check failed",
    );
    await owner`revoke neighborly_staging_migrator from neighborly_staging_app`;
    await owner`create function public.privileged() returns int language sql security definer as 'select 1'`;
    await expect(runMigrations(migration, migrations, { target })).rejects.toThrow(
      "isolation check failed",
    );
    await owner`drop function public.privileged()`;
  });
  it("rolls back failed Staging migrations and grants runtime access to new objects on retry", async () => {
    const next = {
      name: "0009_staging_test.sql",
      checksum: "failed",
      body: "create table isolation_retry(id int); select absent from isolation_retry;",
    };
    await expect(runMigrations(migration, [...migrations, next], { target })).rejects.toThrow();
    const [row] = await owner`select to_regclass('staging.isolation_retry') as table_name`;
    expect(row.table_name).toBeNull();
    await runMigrations(
      migration,
      [
        ...migrations,
        { ...next, checksum: "fixed", body: "create table isolation_retry(id int);" },
      ],
      { target },
    );
    await runtime`insert into staging.isolation_retry values (1)`;
    expect(await runtime`select * from staging.isolation_retry`).toHaveLength(1);
  });
  it("qualifies Drizzle and Better Auth queries and pins triggers across connection search paths", async () => {
    vi.stubEnv("DATABASE_SCHEMA", "staging");
    vi.resetModules();
    const schema = await import("../../../drizzle/schema");
    const { createAuth } = await import("../auth/create-auth");
    const db = drizzle(runtime, { schema });
    expect(db.select().from(schema.projects).toSQL().sql).toContain('"staging"."projects"');
    const [project] = await db
      .insert(schema.projects)
      .values({ name: "Staging project" })
      .returning();
    await db.update(schema.projects).set({ name: "Staging updated" });
    expect((await db.select().from(schema.projects))[0].name).toBe("Staging updated");
    await db.delete(schema.projects);
    expect(project.name).toBe("Staging project");
    // Simulate a pooled connection with a different search path; trigger function
    // bodies must still resolve their own Staging tables.
    await runtime.begin(async (tx) => {
      await tx`set local search_path = public, pg_catalog`;
      const [party] = await tx`insert into staging.parties(kind) values ('person') returning id`;
      await tx`insert into staging.people(party_id, full_name) values (${party.id}, 'Synthetic Resident')`;
    });
    const auth = createAuth(db, {
      baseURL: "http://localhost:3000",
      secret: "staging_test_secret_that_is_long_enough_123",
    });
    const [user] = await db
      .insert(schema.appUsers)
      .values({ email: "staging@example.test", displayName: "Synthetic", emailVerified: true })
      .returning();
    const context = await auth.$context;
    await context.internalAdapter.createSession(user.id);
    expect(await db.select().from(schema.authSessions)).toHaveLength(1);
    expect(
      await owner`select * from public.app_users where email='staging@example.test'`,
    ).toHaveLength(0);
  });
});
