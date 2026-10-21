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
  // Walk bounded cause/AggregateError chains, accepting only known codes below.
  const pending = [error];
  const seen = new Set();
  let code = "";

  const hints = {
    ENOENT: "Migration file or directory was not found in the deployment checkout.",
    EACCES: "Migration files could not be read due to filesystem permissions.",
    ERR_INVALID_URL: "Migration connection URL is invalid.",
    ERR_INVALID_ARG_TYPE: "Migration configuration has an invalid value type.",
    ERR_SSL_REQUIRED: "Database requires TLS; check migration connection SSL settings.",
    SELF_SIGNED_CERT_IN_CHAIN: "Database TLS certificate chain was rejected.",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: "Database TLS certificate could not be verified.",
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
  for (let count = 0; pending.length && count < 10; count++) {
    const current = pending.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    if (
      typeof current.code === "string" &&
      (Object.hasOwn(hints, current.code) || /^[0-9A-Z]{5}$/.test(current.code))
    ) {
      code = current.code;
      break;
    }
    pending.push(current.cause);
    if (current instanceof AggregateError) pending.push(...current.errors.slice(0, 10));
  }
  const kind =
    error instanceof TypeError ? "TypeError" : error instanceof RangeError ? "RangeError" : "Error";
  const hint = Object.hasOwn(hints, code) ? hints[code] : undefined;
  const safeCode = hint || /^[0-9A-Z]{5}$/.test(code) ? code : "unavailable";
  return `Deployment ${stage} failed (code ${safeCode}, kind ${kind}). ${hint ?? "Check configuration, migration history and protected database logs."}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let stage = "configuration";
  try {
    await deploymentBuild(process.env, {
      validateConnection: migrationConnection,
      migrateDatabase: (options) => {
        stage = "migration";
        return migrate({
          ...options,
          onProgress: (step) => {
            stage = `migration/${step}`;
            console.log(`Migration step: ${step}`);
          },
        });
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
