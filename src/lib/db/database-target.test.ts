import { describe, expect, it } from "vitest";
import { databaseTarget, validateDatabaseConnection } from "../../../scripts/db/target.mjs";
import { validateStagingConnections } from "../../../scripts/db/staging-isolation.mjs";
import { deploymentBuild } from "../../../scripts/vercel-build.mjs";

const staging = {
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "staging",
  DATABASE_SCHEMA: "staging",
  DATABASE_URL: "postgres://neighborly_staging_app.project:test@db.test:5432/postgres",
  MIGRATION_DATABASE_URL:
    "postgres://neighborly_staging_migrator.project:test@db.test:5432/postgres",
};

describe("database deployment targets", () => {
  it("preserves public and the existing Production history by default", () => {
    expect(databaseTarget({})).toMatchObject({
      schema: "public",
      history: "neighborly_migrations",
    });
    expect(databaseTarget(staging)).toMatchObject({
      schema: "staging",
      history: "neighborly_staging_migrations",
    });
  });
  it.each(["public; drop schema public", "development", "STAGING"])(
    "rejects unapproved schema %s",
    (schema) => {
      expect(() => databaseTarget({ DATABASE_SCHEMA: schema })).toThrow();
    },
  );
  it("fails closed on Staging without its schema, and secrets scoped to a different deployment", () => {
    expect(() => databaseTarget({ ...staging, DATABASE_SCHEMA: "" })).toThrow();
    expect(() => databaseTarget({ ...staging, VERCEL_ENV: "production" })).toThrow();
    expect(() => databaseTarget({ ...staging, VERCEL_GIT_COMMIT_REF: "feat/other" })).toThrow();
    expect(() => databaseTarget({ NEIGHBORLY_ENV_TARGET: "staging" })).toThrow();
  });
  it("rejects admin credentials, swapped roles, URL overrides and transaction-pool migrations", () => {
    const target = databaseTarget(staging);
    for (const url of [
      "postgres://postgres:test@db.test/postgres",
      staging.MIGRATION_DATABASE_URL,
      staging.DATABASE_URL + "?options=-csearch_path=public",
    ])
      expect(() => validateDatabaseConnection(url, target, "runtime")).toThrow();
    expect(() =>
      validateDatabaseConnection(
        staging.MIGRATION_DATABASE_URL.replace(":5432", ":6543"),
        target,
        "migration",
      ),
    ).toThrow();
    expect(() =>
      validateStagingConnections({
        ...staging,
        MIGRATION_DATABASE_URL: staging.MIGRATION_DATABASE_URL.replace("db.test", "other.test"),
      }),
    ).toThrow();
    expect(() =>
      validateStagingConnections({
        ...staging,
        MIGRATION_DATABASE_URL: staging.MIGRATION_DATABASE_URL.replace(
          ".project:",
          ".otherproject:",
        ),
      }),
    ).toThrow();
    expect(() =>
      validateStagingConnections({ ...staging, MIGRATION_DATABASE_URL: undefined }),
    ).toThrow();
  });
  it("runs the migration gate only after a successful Staging build", async () => {
    const calls: string[] = [];
    const operations = {
      build: async () => {
        calls.push("build");
      },
      validateConnection: () => {
        calls.push("validate");
      },
      migrateDatabase: async () => {
        calls.push("migrate");
      },
    };
    await deploymentBuild(staging, operations);
    expect(calls).toEqual(["validate", "build", "migrate"]);
    calls.length = 0;
    await expect(
      deploymentBuild({ ...staging, DATABASE_SCHEMA: "public" }, operations),
    ).rejects.toThrow();
    expect(calls).toEqual([]);
    await expect(
      deploymentBuild(staging, {
        ...operations,
        build: async () => {
          throw new Error("failed");
        },
      }),
    ).rejects.toThrow("failed");
    expect(calls).toEqual(["validate"]);
  });
});
