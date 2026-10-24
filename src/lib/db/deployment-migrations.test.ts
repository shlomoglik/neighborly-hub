import { expect, it, vi } from "vitest";
import {
  loadMigrations,
  migrationBody,
  migrationConnection,
  migrationPlan,
  runMigrations,
} from "../../../scripts/db/migrations.mjs";
import { deploymentBuild, deploymentFailureMessage } from "../../../scripts/vercel-build.mjs";

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

it.each([
  ["28P01", "authentication failed"],
  ["42501", "privileges"],
  ["ECONNREFUSED", "connection refused"],
  ["CONNECT_TIMEOUT", "timed out"],
  ["23505", "23505"],
])("reports safe deployment diagnostics for %s without leaking driver data", (code, expected) => {
  const secret = "postgres://user:password@private-host/database";
  const error = Object.assign(new Error(secret), {
    code,
    detail: secret,
    query: "SELECT private_resident_data",
    cause: new Error(secret),
  });
  const message = deploymentFailureMessage(error, "migration");
  expect(message).toContain("Deployment migration failed");
  expect(message).toContain(expected);
  expect(message).not.toContain(secret);
  expect(message).not.toContain("private_resident_data");
});
it.each([
  undefined,
  null,
  "secret",
  { code: "postgres://user:password@host/db" },
  { code: "toString" },
])("handles unknown deployment failures safely: %j", (error) => {
  const message = deploymentFailureMessage(error, "configuration");
  expect(message).toContain("Deployment configuration failed (code unavailable, kind Error)");
  expect(message).not.toContain("password");
});

it("finds nested and aggregate driver codes without logging private messages", () => {
  const cause = Object.assign(new Error("private credentials"), { code: "28P01" });
  const nested = new Error("private SQL", { cause });
  expect(deploymentFailureMessage(nested, "migration/history")).toContain("28P01");
  expect(
    deploymentFailureMessage(new AggregateError([nested]), "migration/connect-and-begin"),
  ).toContain("authentication failed");
  expect(deploymentFailureMessage(nested, "migration/history")).not.toContain("private");
});
it("handles cyclic causes and identifies uncoded programming errors safely", () => {
  const error = new TypeError("private connection string");
  error.cause = error;
  const message = deploymentFailureMessage(error, "migration/create-client");
  expect(message).toContain("kind TypeError");
  expect(message).toContain("code unavailable");
  expect(message).not.toContain("private");
});
it.each(["ENOENT", "ERR_SSL_REQUIRED", "SELF_SIGNED_CERT_IN_CHAIN"])("recognizes %s", (code) => {
  expect(deploymentFailureMessage({ code }, "migration/load-files")).toContain(`code ${code}`);
});

it("reports migration checkpoints and the filename before SQL fails", async () => {
  const events: string[] = [];
  const failure = Object.assign(new Error("private SQL"), { code: "42501" });
  const tx = Object.assign(
    (strings: TemplateStringsArray | string) => {
      if (typeof strings === "string") return strings;
      const query = strings.join("");
      if (query.includes("to_regclass")) return [{ history: null }];
      if (query.includes("as populated")) return [{ populated: false }];
      return [];
    },
    { unsafe: vi.fn().mockRejectedValue(failure) },
  );
  const sql = { begin: (callback: (transaction: typeof tx) => unknown) => callback(tx) };
  await expect(
    runMigrations(sql, [{ name: "0001_test.sql", checksum: "hash", body: "SQL" }], {
      onProgress: (step: string) => events.push(step),
    }),
  ).rejects.toBe(failure);
  expect(events).toEqual(["connect-and-begin", "lock", "history", "apply:0001_test.sql"]);
});
