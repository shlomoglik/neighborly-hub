import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { migrate, migrationConnection, MigrationError } from "./db/migrations.mjs";

export async function deploymentBuild(environment, { build, migrateDatabase, validateConnection }) {
  if (
    environment.VERCEL !== "1" ||
    !["production", "preview", "development"].includes(environment.VERCEL_ENV)
  ) {
    throw new Error("Vercel system environment variables are required; use pnpm build locally");
  }
  const production = environment.VERCEL_ENV === "production";
  if (production) validateConnection(environment);
  await build();
  // Failed builds never migrate, and failed migrations fail the deployment before publication.
  if (production) await migrateDatabase({ environment });
}

// Only emit validated codes and fixed hints; driver messages may contain credentials or SQL.
export function deploymentFailureMessage(error, stage) {
  const code = typeof error?.code === "string" ? error.code : "";
  const hints = {
    ECONNRESET: "Database connection was reset; check database availability.",
    CONNECTION_CLOSED: "Database connection closed unexpectedly; check database availability.",
    CONNECTION_ENDED: "Database connection ended unexpectedly; check database availability.",
    ECONNREFUSED: "Database connection refused; check the migration host and port.",
    ENOTFOUND: "Database hostname could not be resolved; check the migration host.",
    EAI_AGAIN: "Database DNS lookup failed temporarily.",
    ETIMEDOUT: "Database connection timed out; check network access and pooling mode.",
    CONNECT_TIMEOUT: "Database connection timed out; check network access and pooling mode.",
    "28P01": "Database authentication failed; check the migration credentials.",
    42501: "Database role lacks required migration privileges.",
    "42P07": "A migration tried to create an existing table; verify migration history.",
    "55P03": "Database lock timeout; check for concurrent migrations or schema changes.",
    57014: "Database statement was canceled or timed out.",
  };
  const hint = Object.hasOwn(hints, code) ? hints[code] : undefined;
  const safeCode = hint || /^[0-9A-Z]{5}$/.test(code) ? code : "unavailable";
  return `Deployment ${stage} failed (code ${safeCode}). ${hint ?? "Check configuration, migration history and protected database logs."}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let stage = "configuration";
  try {
    await deploymentBuild(process.env, {
      validateConnection: migrationConnection,
      migrateDatabase: (options) => {
        stage = "migration";
        return migrate(options);
      },
      build: () => {
        stage = "build";
        const result = spawnSync("pnpm", ["build"], { stdio: "inherit", env: process.env });
        if (result.error || result.status !== 0) throw new Error("Application build failed");
      },
    });
  } catch (error) {
    console.error(deploymentFailureMessage(error, stage));
    if (error instanceof MigrationError) console.error(error.message);
    console.error(
      "Production build/migration gate failed. Deployment blocked; see docs/deployment-migrations.md.",
    );
    process.exitCode = 1;
  }
}
