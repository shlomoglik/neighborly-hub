import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const environments = ["local", "development", "staging", "production"];
const target = process.argv[2];
if (!environments.includes(target) || process.argv.length !== 3) {
  console.error("Usage: node scripts/dev-environment.mjs <local|development|staging|production>");
  process.exit(1);
}
const filename = resolve(`.env.${target}.local`);
if (!existsSync(filename)) {
  console.error(`Missing ${filename}. Copy .env.${target}.example and configure it.`);
  process.exit(1);
}
const config = {};
for (const raw of readFileSync(filename, "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) throw new Error("Invalid environment file entry");
  const value = match[2].trim();
  config[match[1]] = /^(['"]).*\1$/.test(value) ? value.slice(1, -1) : value;
}
for (const key of ["DATABASE_URL", "BETTER_AUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) {
  if (!config[key]) throw new Error(`Missing required setting: ${key}`);
}
const url = new URL(config.DATABASE_URL);
if (!["postgres:", "postgresql:"].includes(url.protocol))
  throw new Error("Expected PostgreSQL DATABASE_URL");
if (target === "local" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
  throw new Error("Local target requires a loopback database host");
}
if (target !== "local" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
  throw new Error("Remote target requires a remote database host");
}
if (target === "production" && config.ALLOW_PRODUCTION_DEBUG !== "true") {
  throw new Error(
    "Production debugging requires ALLOW_PRODUCTION_DEBUG=true in the private environment file",
  );
}
if (target === "production" && config.DATABASE_READ_ONLY !== "true") {
  throw new Error(
    "Production debugging requires DATABASE_READ_ONLY=true and a database role restricted to SELECT",
  );
}
const env = {
  ...process.env,
  ...config,
  BETTER_AUTH_URL: "http://localhost:3000",
  NEIGHBORLY_ENV_TARGET: target,
  NEXT_TELEMETRY_DISABLED: "1",
};
delete env.MIGRATION_DATABASE_URL;
const result = spawnSync("pnpm", ["exec", "next", "dev"], { stdio: "inherit", env });
process.exit(result.status ?? 1);
