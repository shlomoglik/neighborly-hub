import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, runMigrations } from "../../../scripts/db/migrations.mjs";

// Disposable databases only. Never point this variable at production.
const url = process.env.MIGRATION_TEST_DATABASE_URL;
describe.skipIf(!url)("deployment migration runner against real PostgreSQL", () => {
  let admin: ReturnType<typeof postgres>;
  let sql: ReturnType<typeof postgres>;
  let database: string;
  let connection: string;
  beforeEach(async () => {
    admin = postgres(url!, { max: 1, prepare: false, onnotice: () => {} });
    database = `migration_test_${randomUUID().replaceAll("-", "")}`;
    await admin`create database ${admin(database)}`;
    const target = new URL(url!);
    target.pathname = `/${database}`;
    connection = target.href;
    sql = postgres(connection, { max: 1, prepare: false, onnotice: () => {} });
  });
  afterEach(async () => {
    if (sql) await sql.end();
    if (database && admin) await admin`drop database if exists ${admin(database)} with (force)`;
    if (admin) await admin.end();
  });
  it("initializes an empty database and repeats without changing schema or history", async () => {
    const migrations = await loadMigrations();
    expect(await runMigrations(sql, migrations)).toEqual({ applied: 7, baselined: 0 });
    expect(await runMigrations(sql, migrations)).toEqual({ applied: 0, baselined: 0 });
    await sql`select address from buildings limit 0`;
    const [row] = await sql`select count(*)::int as count from neighborly_migrations.history`;
    expect(row.count).toBe(7);
  });
  it("rolls back DDL and history together and allows a corrected pending migration", async () => {
    const migrations = await loadMigrations();
    await runMigrations(sql, migrations);
    const failing = {
      name: "0008_retry.sql",
      checksum: "failed",
      body: "create table retry_test(id int); select missing_column from retry_test;",
    };
    await expect(runMigrations(sql, [...migrations, failing])).rejects.toThrow();
    const [row] =
      await sql`select to_regclass('retry_test') as table_name, (select count(*)::int from neighborly_migrations.history) as count`;
    expect(row).toMatchObject({ table_name: null, count: 7 });
    expect(
      await runMigrations(sql, [
        ...migrations,
        { ...failing, checksum: "fixed", body: "create table retry_test(id int);" },
      ]),
    ).toEqual({ applied: 1, baselined: 0 });
  });
  it("refuses drift and older releases without mutating history", async () => {
    const migrations = await loadMigrations();
    await runMigrations(sql, migrations);
    await expect(runMigrations(sql, migrations.slice(0, -1))).rejects.toThrow("history differs");
    await expect(
      runMigrations(sql, [{ ...migrations[0], checksum: "changed" }, ...migrations.slice(1)]),
    ).rejects.toThrow("history differs");
  });
  it("requires explicit adoption of manually initialized databases and applies subsequent migrations", async () => {
    const migrations = await loadMigrations();
    for (const migration of migrations) await sql.unsafe(migration.body);
    await sql`insert into projects(name) values ('Preserved existing data')`;
    await expect(runMigrations(sql, migrations)).rejects.toThrow("explicit verified baselining");
    expect(
      await runMigrations(sql, migrations, { baselineThrough: migrations.at(-1)!.name }),
    ).toEqual({ applied: 0, baselined: 7 });
    expect(await runMigrations(sql, migrations)).toEqual({ applied: 0, baselined: 0 });
    const [row] = await sql`select count(*)::int as count from projects`;
    expect(row.count).toBe(1);
    await expect(
      runMigrations(sql, migrations, { baselineThrough: migrations[0].name }),
    ).rejects.toThrow();
  });
  it("serializes simultaneous migration runs using the database lock", async () => {
    const migrations = await loadMigrations();
    const other = postgres(connection, { max: 1, prepare: false, onnotice: () => {} });
    try {
      const results = await Promise.all([
        runMigrations(sql, migrations),
        runMigrations(other, migrations),
      ]);
      expect(results.map((result) => result.applied).sort()).toEqual([0, 7]);
    } finally {
      await other.end();
    }
  });
});
