import { expect, it, vi } from "vitest";
import {
  loadMigrations,
  migrationBody,
  migrationConnection,
  migrationPlan,
} from "../../../scripts/db/migrations.mjs";
import { deploymentBuild } from "../../../scripts/vercel-build.mjs";

it("loads only the eight authoritative SQL migrations and preserves function bodies", async () => {
  const migrations = await loadMigrations();
  expect(migrations).toHaveLength(8);
  expect(migrations[1].body).toContain("BEGIN\n");
  expect(migrations[0].checksum).toMatch(/^[a-f0-9]{64}$/);
});
it.each([
  "CREATE TABLE a(id int); COMMIT;",
  "BEGIN; CREATE TABLE a(id int);",
  "BEGIN; COMMIT; BEGIN; COMMIT;",
  "BEGIN; ROLLBACK; COMMIT;",
  "BEGIN; END; COMMIT;",
])("rejects invalid transaction boundaries", (source) => {
  expect(() => migrationBody(source)).toThrow();
});
it("preserves SQL literals and quoted procedural bodies", () => {
  expect(migrationBody("-- comment\nBEGIN; SELECT 'COMMIT;', $$BEGIN; END;$$; COMMIT;")).toContain(
    "$$BEGIN; END;$$",
  );
});
it("rejects modified, missing, reordered and unknown applied migrations", () => {
  const files = [
    { name: "0001_a.sql", checksum: "a" },
    { name: "0002_b.sql", checksum: "b" },
  ];
  expect(migrationPlan(files, [files[0]])).toEqual([files[1]]);
  for (const history of [
    [{ ...files[0], checksum: "changed" }],
    [files[1]],
    [...files, { name: "0003_c.sql", checksum: "c" }],
  ]) {
    expect(() => migrationPlan(files, history)).toThrow();
  }
});
it("requires a dedicated migration connection without falling back to runtime credentials", () => {
  expect(() => migrationConnection({ DATABASE_URL: "postgres://production" })).toThrow();
  expect(() => migrationConnection({ MIGRATION_DATABASE_URL: "https://example.test" })).toThrow();
});
function steps() {
  return {
    build: vi.fn().mockResolvedValue(undefined),
    migrateDatabase: vi.fn().mockResolvedValue(undefined),
    validateConnection: vi.fn(),
  };
}
it("builds before migrating Production and validates configuration first", async () => {
  const events: string[] = [];
  await deploymentBuild(
    { VERCEL: "1", VERCEL_ENV: "production" },
    {
      validateConnection: () => {
        events.push("validate");
      },
      build: async () => {
        events.push("build");
      },
      migrateDatabase: async () => {
        events.push("migrate");
      },
    },
  );
  expect(events).toEqual(["validate", "build", "migrate"]);
});
it.each(["preview", "development"])(
  "never migrates %s even with a database URL present",
  async (environment) => {
    const operations = steps();
    await deploymentBuild(
      { VERCEL: "1", VERCEL_ENV: environment, MIGRATION_DATABASE_URL: "postgres://production" },
      operations,
    );
    expect(operations.build).toHaveBeenCalledOnce();
    expect(operations.validateConnection).not.toHaveBeenCalled();
    expect(operations.migrateDatabase).not.toHaveBeenCalled();
  },
);
it("fails closed on unknown environment or missing system variables", async () => {
  const operations = steps();
  for (const environment of [{}, { VERCEL: "1", VERCEL_ENV: "unknown" }]) {
    await expect(deploymentBuild(environment, operations)).rejects.toThrow();
  }
  expect(operations.build).not.toHaveBeenCalled();
});
it("does not migrate a failed build or build without valid migration configuration", async () => {
  const environment = { VERCEL: "1", VERCEL_ENV: "production" };
  const operations = steps();
  operations.validateConnection.mockImplementationOnce(() => {
    throw new Error("missing connection");
  });
  await expect(deploymentBuild(environment, operations)).rejects.toThrow();
  expect(operations.build).not.toHaveBeenCalled();
  operations.build.mockRejectedValueOnce(new Error("build failed"));
  await expect(deploymentBuild(environment, operations)).rejects.toThrow();
  expect(operations.migrateDatabase).not.toHaveBeenCalled();
});
it("propagates migration failures so Vercel cannot publish the build", async () => {
  const operations = steps();
  operations.migrateDatabase.mockRejectedValueOnce(new Error("migration failed"));
  await expect(
    deploymentBuild({ VERCEL: "1", VERCEL_ENV: "production" }, operations),
  ).rejects.toThrow("migration failed");
});
