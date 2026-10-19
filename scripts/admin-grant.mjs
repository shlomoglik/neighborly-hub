import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const [target, ...args] = process.argv.slice(2);
const supported = ["local", "development", "staging"];
if (!supported.includes(target)) {
  throw new Error(
    "Usage: node scripts/admin-grant.mjs <local|development|staging> --email <address>",
  );
}
if (args.length !== 2 || args[0] !== "--email" || !args[1].trim()) {
  throw new Error("Specify exactly one --email <address>");
}
const email = args[1].trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
const file = resolve(`.env.${target}.local`);
const env = {};
for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) throw new Error("Invalid environment file entry");
  const value = match[2].trim();
  env[match[1]] = /^(['"]).*\1$/.test(value) ? value.slice(1, -1) : value;
}
if (!env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
const url = new URL(env.DATABASE_URL);
if (!["postgres:", "postgresql:"].includes(url.protocol))
  throw new Error("Expected PostgreSQL URL");
const host = url.hostname.toLowerCase();
const loopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host);
if (target === "local" && !loopback) throw new Error("Local target requires loopback PostgreSQL");
if (target !== "local" && loopback) throw new Error("Remote target requires remote PostgreSQL");
if (env.DATABASE_READ_ONLY === "true" || env.ALLOW_PRODUCTION_DEBUG === "true") {
  throw new Error("Refusing admin changes with production-debug configuration");
}
if (/prod(uction)?/i.test(host) || /prod(uction)?/i.test(url.pathname)) {
  throw new Error("Refusing a production-looking database");
}
if (target !== "local" && env.ALLOW_REMOTE_ADMIN_BOOTSTRAP !== "true") {
  throw new Error(
    "Remote bootstrap requires ALLOW_REMOTE_ADMIN_BOOTSTRAP=true in the selected private env file",
  );
}
const sql = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 5 });
try {
  const users = await sql`
    SELECT id, email FROM public.app_users
    WHERE lower(email) = ${email} AND email_verified = true
  `;
  if (users.length !== 1) {
    throw new Error("Exactly one verified existing user is required; sign in with Google first");
  }
  const [user] = users;
  const existing = await sql`
    SELECT 1 FROM public.global_roles WHERE user_id = ${user.id} AND role = 'admin'
  `;
  if (existing.length) {
    console.log(`Admin already configured: ${user.email}`);
  } else {
    await sql`
      INSERT INTO public.global_roles (user_id, role)
      VALUES (${user.id}, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING
    `;
    console.log(`Admin granted: ${user.email}`);
  }
} finally {
  await sql.end();
}
