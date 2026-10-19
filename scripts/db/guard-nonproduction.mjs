/** Import this guard before any future seed or system-test database writes. */
export function assertNonProductionTarget(env = process.env) {
  const target = env.NEIGHBORLY_ENV_TARGET;
  if (!["local", "development", "staging"].includes(target)) {
    throw new Error("Database fixtures require an explicit non-production environment target");
  }
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const hostname = new URL(url).hostname.toLowerCase();
  if (target === "local" && !["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new Error("Local fixtures require a loopback database");
  }
  if (/prod(uction)?/i.test(hostname) || /prod(uction)?/i.test(new URL(url).pathname)) {
    throw new Error("Refusing fixtures against a production-looking database");
  }
  if (env.DATABASE_READ_ONLY === "true") throw new Error("Read-only database cannot accept fixtures");
}
