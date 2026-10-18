import { migrate, MigrationError } from "./migrations.mjs";

try {
  const args = process.argv.slice(2);
  const baseline = args.find((arg) => arg.startsWith("--baseline-through="));
  if (
    (baseline &&
      (!/^--baseline-through=\d{4}_[a-z0-9_]+\.sql$/.test(baseline) || args.length !== 2)) ||
    args.some((arg) => arg !== baseline && arg !== "--acknowledge-existing-schema") ||
    (baseline && !args.includes("--acknowledge-existing-schema")) ||
    (!baseline && args.length)
  ) {
    throw new MigrationError(
      "Use no arguments, or --baseline-through=<filename> --acknowledge-existing-schema after verifying the existing schema",
    );
  }
  const result = await migrate({ baselineThrough: baseline?.split("=")[1] });
  console.log(`Migrations complete: ${result.applied} applied, ${result.baselined} baselined`);
} catch (error) {
  // Do not print driver errors, SQL, connection strings or row values.
  const code =
    typeof error?.code === "string" && /^[0-9A-Z]{5}$/.test(error.code)
      ? error.code
      : "unavailable";
  if (error instanceof MigrationError) console.error(error.message);
  console.error(
    `Migration failed (SQLSTATE ${code}). Check connection, history and deployment-migrations.md; deployment blocked.`,
  );
  process.exitCode = 1;
}
