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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await deploymentBuild(process.env, {
      validateConnection: migrationConnection,
      migrateDatabase: migrate,
      build: () => {
        const result = spawnSync("pnpm", ["build"], { stdio: "inherit", env: process.env });
        if (result.error || result.status !== 0) throw new Error("Application build failed");
      },
    });
  } catch (error) {
    if (error instanceof MigrationError) console.error(error.message);
    console.error(
      "Production build/migration gate failed. Deployment blocked; see docs/deployment-migrations.md.",
    );
    process.exitCode = 1;
  }
}
