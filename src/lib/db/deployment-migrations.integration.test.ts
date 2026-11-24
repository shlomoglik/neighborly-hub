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
    expect(await runMigrations(sql, migrations)).toEqual({
      applied: migrations.length,
      baselined: 0,
    });
    expect(await runMigrations(sql, migrations)).toEqual({ applied: 0, baselined: 0 });
    await sql`select address from buildings limit 0`;
    const [row] = await sql`select count(*)::int as count from neighborly_migrations.history`;
    expect(row.count).toBe(migrations.length);
  });
  it("preserves a pending personal apartment request when adding direct acceptance", async () => {
    const migrations = await loadMigrations();
    await runMigrations(
      sql,
      migrations.filter((m) => m.name < "0012"),
    );
    const [issuer, recipient] = await sql`
      insert into app_users(email) values ('issuer@example.test'), ('recipient@example.test')
      returning id
    `;
    const [project] = await sql`insert into projects(name) values ('Upgrade fixture') returning id`;
    const [building] = await sql`
      insert into buildings(project_id, name) values (${project.id}, 'A') returning id
    `;
    const [floor] = await sql`
      insert into floors(building_id, number) values (${building.id}, 0) returning id
    `;
    const [apartment] = await sql`
      insert into apartments(building_id, floor_id, number)
      values (${building.id}, ${floor.id}, '1') returning id
    `;
    const [invite] = await sql`
      insert into invitations(kind, project_id, building_id, apartment_id, recipient_email,
        recipient_user_id, token_hash, created_by, expires_at, consumed_at)
      values ('resident', ${project.id}, ${building.id}, ${apartment.id}, 'recipient@example.test',
        ${recipient.id}, ${"a".repeat(64)}, ${issuer.id}, now() + interval '1 day', now())
      returning id
    `;
    const [request] = await sql`
      insert into join_requests(invitation_id, user_id, apartment_id, full_name, household_name)
      values (${invite.id}, ${recipient.id}, ${apartment.id}, 'Resident', 'Household')
      returning id
    `;

    await runMigrations(sql, migrations);

    const [saved] = await sql`
      select acceptance_policy, status, authorized_by, accepted_at
      from invitations join join_requests on invitations.id = invitation_id
      where join_requests.id = ${request.id}
    `;
    expect(saved).toEqual({
      acceptance_policy: "manual_review",
      status: "pending",
      authorized_by: null,
      accepted_at: null,
    });
    const [review] = await sql`
      update join_requests set status = 'approved', reviewed_by = ${issuer.id}, reviewed_at = now()
      where id = ${request.id} returning reviewed_by
    `;
    expect(review.reviewed_by).toBe(issuer.id);
  });
  it("rolls back DDL and history together and allows a corrected pending migration", async () => {
    const migrations = await loadMigrations();
    await runMigrations(sql, migrations);
    const failing = {
      name: "0012_retry.sql",
      checksum: "failed",
      body: "create table retry_test(id int); select missing_column from retry_test;",
    };
    await expect(runMigrations(sql, [...migrations, failing])).rejects.toThrow();
    const [row] =
      await sql`select to_regclass('retry_test') as table_name, (select count(*)::int from neighborly_migrations.history) as count`;
    expect(row).toMatchObject({ table_name: null, count: migrations.length });
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
    ).toEqual({ applied: 0, baselined: migrations.length });
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
      expect(results.map((result) => result.applied).sort()).toEqual([0, migrations.length]);
    } finally {
      await other.end();
    }
  });
});
