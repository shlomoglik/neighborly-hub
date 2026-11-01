/** Fixed deployment targets; never accept arbitrary SQL schema/role identifiers. */
/** @param {Record<string, string | undefined>} environment */
export function databaseTarget(environment = process.env) {
  const schema = environment.DATABASE_SCHEMA || "public";
  if (!["public", "staging"].includes(schema)) throw new Error("Invalid DATABASE_SCHEMA");
  const hosted = environment.VERCEL === "1";
  const stagingBranch =
    hosted &&
    environment.VERCEL_ENV === "preview" &&
    environment.VERCEL_GIT_COMMIT_REF === "staging";
  if ((stagingBranch || environment.NEIGHBORLY_ENV_TARGET === "staging") && schema !== "staging") {
    throw new Error("Staging requires DATABASE_SCHEMA=staging");
  }
  if (hosted && schema === "staging" && !stagingBranch) {
    throw new Error("Staging database is restricted to the staging Preview branch");
  }
  return schema === "staging"
    ? {
        schema,
        history: "neighborly_staging_migrations",
        runtimeRole: "neighborly_staging_app",
        migrationRole: "neighborly_staging_migrator",
      }
    : { schema, history: "neighborly_migrations" };
}

export function validateDatabaseConnection(connection, target, kind) {
  let url;
  try {
    url = new URL(connection);
  } catch {
    throw new Error("Invalid database connection URL");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("Invalid database connection protocol");
  if (target.schema === "staging") {
    // Supavisor adds .<project-ref> to the PostgreSQL role name.
    const role = decodeURIComponent(url.username).split(".")[0];
    if (role !== (kind === "migration" ? target.migrationRole : target.runtimeRole)) {
      throw new Error("Staging requires its dedicated database role");
    }
    if ([...url.searchParams.keys()].some((key) => !["sslmode"].includes(key))) {
      throw new Error("Staging database URL accepts only sslmode connection options");
    }
    if (kind === "migration" && url.port === "6543")
      throw new Error("Migrations require direct or session-mode access");
  }
  return url;
}

/** Validate whether a local CLI target may use a loopback PostgreSQL endpoint. */
export function validateEnvironmentHost(url, environment) {
  const loopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname.toLowerCase());
  if (environment === "local" && !loopback)
    throw new Error("Local target requires a loopback database host");
  if (["development", "production"].includes(environment) && loopback)
    throw new Error("Remote target requires a remote database host");
  // Staging may use a local container or a remote database, but always requires its dedicated role/schema.
  return loopback;
}
