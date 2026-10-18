/** Test-only fixtures are deliberately restricted to a named loopback database. */
export function pilotFixtureConfig(env: Record<string, string | undefined>) {
  const database = new URL(env.PILOT_E2E_DATABASE_URL ?? "");
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !["localhost", "127.0.0.1"].includes(database.hostname) ||
    database.pathname !== "/neighborly_pilot" ||
    env.DATABASE_URL !== env.PILOT_E2E_DATABASE_URL
  )
    throw new Error("Pilot fixtures require the isolated loopback neighborly_pilot database");
  if (
    env.BETTER_AUTH_URL !== "https://127.0.0.1:3443" ||
    !env.PILOT_FIXTURE_DIRECTORY ||
    !env.BETTER_AUTH_SECRET?.startsWith("pilot-ci-only-") ||
    env.BETTER_AUTH_SECRET.length < 32 ||
    env.GOOGLE_CLIENT_ID !== "pilot-not-a-real-google-client" ||
    env.GOOGLE_CLIENT_SECRET !== "pilot-not-a-real-google-secret"
  )
    throw new Error(
      "Pilot fixtures require the isolated CI origin and synthetic auth configuration",
    );
  return {
    databaseURL: database.href,
    directory: env.PILOT_FIXTURE_DIRECTORY,
    origin: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
  };
}
